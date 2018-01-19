Liquid = require "../liquid"
{ _ } = require "underscore"
Q = require "q"

module.exports = class Context

  constructor: (environments = {}, outerScope = {}, registers = {}, rethrowErrors = false) ->
    @environments = _.flatten [environments]
    @scopes = [outerScope or {}]
    @registers = registers
    @errors = []
    @rethrowErrors = rethrowErrors
    @strainer = Liquid.Strainer.create(@)
    @squashInstanceAssignsWithEnvironments()


  # Adds filters to this context.
  #
  # Note that this does not register the filters with the main
  # Template object. see <tt>Template.register_filter</tt>
  # for that
  addFilters: (filters) ->
    filters = _([filters]).chain().flatten().compact().value()
    filters.forEach (filter) =>
      unless filter instanceof Object
        throw new Error("Expected Object but got: #{typeof(filter)}")

      _.extend @strainer, filter

  handleError: (e) ->
    @errors.push e
    throw e if @rethrowErrors

    if e instanceof Liquid.SyntaxError
      "Liquid syntax error: #{e.message}"
    else
      "Liquid error: #{e.message}"

  invoke: (method, args...) ->
    if @strainer[method]?
      f = @strainer[method]
      f.apply(@strainer, args)
    else
      args?[0]

  push: (newScope = {}) ->
    Liquid.log "SCOPE PUSH"
    @scopes.unshift newScope
    throw new Error("Nesting too deep") if @scopes.length > 100

  merge: (newScope = {}) ->
    _(@scopes[0]).extend(newScope)

  pop: ->
    Liquid.log "SCOPE POP"
    throw new Error("ContextError") if @scopes.length <= 1
    @scopes.shift()

  lastScope: ->
    @scopes[@scopes.length-1]

  # Pushes a new local scope on the stack, pops it at the end of the block
  #
  # Example:
  #   context.stack do
  #      context['var'] = 'hi'
  #   end
  #
  #   context['var]  #=> nil
  stack: (newScope = {}, f) ->
    popLater = false

    try
      if arguments.length < 2
        f = newScope
        newScope = {}

      @push(newScope)
      result = f()

      if Q.isPromise result
        popLater = true
        result.nodeify => @pop()

      result
    finally
      @pop() unless popLater

  clearInstanceAssigns: ->
    @scopes[0] = {}

  # Only allow String, Numeric, Hash, Array, Proc, Boolean
  # or <tt>Liquid::Drop</tt>
  set: (key, value) ->
    Liquid.log "[SET] %s %j", key, value
    @scopes[0][key] = value

  get: (key) ->
    value = @resolve(key)
    Liquid.log "[GET] %s %j", key, value
    value

  hasKey: (key) ->
    !!@resolve(key)

  # PRIVATE API

  @Literals =
    'null': null
    'nil': null
    '': null
    'true': true
    'false': false
    'empty': (v) -> not (v?.length > 0) # false for non-collections
    'blank': (v) -> !v or v.toString().length is 0

  # Look up variable, either resolve directly after considering the name.
  # We can directly handle Strings, digits, floats and booleans (true,false).
  # If no match is made we lookup the variable in the current scope and
  # later move up to the parent blocks to see if we can resolve
  # the variable somewhere up the tree.
  # Some special keywords return symbols. Those symbols are to be called on the rhs object in expressions
  #
  # Example:
  #   products == empty #=> products.empty?
  resolve: (key) ->
    if Liquid.Context.Literals.hasOwnProperty key
      Liquid.Context.Literals[key]
    else if match = /^'(.*)'$/.exec(key) # Single quoted strings
      match[1]
    else if match = /^"(.*)"$/.exec(key) # Double quoted strings
      match[1]
    else if match = /^(\d+)$/.exec(key) # Integer and floats
      Number(match[1])
    else if match = /^\((\S+)\.\.(\S+)\)$/.exec(key) # Ranges
      lo = Number(resolve(match[1]))
      hi = Number(resolve(match[2]))
      throw new Error "Ranges are not supported."
    else if match = /^(\d[\d\.]+)$/.exec(key) # Floats
      Number(match[1])
    else
      @variable(key)


  findVariable: (key) ->
    scope = _(@scopes).detect (scope) -> scope.hasOwnProperty key
    
    variable = undefined
    scope ?= _(@environments).detect (env) =>
      variable = @lookupAndEvaluate(env, key)
      variable?

    scope ?= _(@environments).last or _(@scopes).last
    variable ?= @lookupAndEvaluate(scope, key)
    
    Q.when(variable).then(@liquify.bind(@))

  variable: (markup) ->
    Q.fcall =>
      parts = Liquid.Helpers.scan(markup, Liquid.VariableParser)
      squareBracketed = /^\[(.*)\]$/

      firstPart = parts.shift()

      if match = squareBracketed.exec(firstPart)
        firstPart = match[1]

      object = @findVariable(firstPart)
      return object if parts.length is 0

      mapper = (part, object) =>
        return Q.when(object) unless object?

        Q.when(object).then(@liquify.bind(@)).then (object) =>
          return object unless object?

          bracketMatch = squareBracketed.exec part
          part = @resolve(bracketMatch[1]) if bracketMatch

          Q.when(part).then (part) =>
            isArrayAccess = (_.isArray(object) and _.isNumber(part))
            isObjectAccess = (_.isObject(object) and (part of object))
            isSpecialAccess = (
              !bracketMatch and object and
              (_.isArray(object) or _.isString(object)) and
              ["size", "first", "last"].indexOf(part) >= 0
            )

            if isArrayAccess or isObjectAccess
              # If object is a hash- or array-like object we look for the
              # presence of the key and if its available we return it
              Q.when(@lookupAndEvaluate(object, part)).then(@liquify.bind(@))
            else if isSpecialAccess
              # Some special cases. If the part wasn't in square brackets
              # and no key with the same name was found we interpret
              # following calls as commands and call them on the
              # current object              
              switch part
                when "size"
                  @liquify(object.length)
                when "first"
                  @liquify(object[0])
                when "last"
                  @liquify(object[object.length-1])
                else
                  throw new Error "Unknown special accessor: #{part}"

      # The iterator walks through the parsed path step
      # by step and waits for promises to be fulfilled.
      iterator = (object, index) ->
        if index < parts.length       
          mapper(parts[index], object).then (object) -> iterator(object, index + 1)
        else
          Q.when(object)

      iterator(object, 0).then null, (err) ->
        throw new Error "Couldn't walk variable: #{markup}: #{err}"

  lookupAndEvaluate: (obj, key) ->
    value = obj[key]

    if typeof value is 'function'
      obj[key] = value.call obj, @ # cache result
    else
      value

  squashInstanceAssignsWithEnvironments: ->
    lastScope = @lastScope()

    _(lastScope).chain().keys().forEach (key) =>
      _(@environments).detect (env) =>
        if env.hasOwnProperty key
          lastScope[key] = @lookupAndEvaluate(env, key)
          true

  liquify: (object) ->
    Q.when(object).then (object) =>
      unless object?
        return object 
      else if typeof object.toLiquid is "function"
        object = object.toLiquid()
      else if typeof object is "object"
        true # throw new Error "Complex object #{JSON.stringify(object)} would leak into template."

      object.context = @ if object instanceof Liquid.Drop
      object
