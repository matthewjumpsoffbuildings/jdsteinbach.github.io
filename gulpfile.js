(function() {
  'use strict';

  /**
   * Required node plugins
   */
  var gulp        = require('gulp');
  var glob        = require('glob');
  var del         = require('del');
  var browserSync = require('browser-sync').create();
  var reload      = browserSync.reload;
  var $           = require('gulp-load-plugins')();
  var args        = require('yargs').argv;
  var frontMatter = require('gulp-front-matter');
  var prefix      = require('autoprefixer');
  var cssnano     = require('cssnano');
  var inlineSVG   = require('postcss-inline-svg');
  var inlineB64   = require('postcss-inline-base64');
  var through     = require('through2');
  var path        = require('path');


  /**
   * Set up file paths
   */
  var _dist_dir   = '_site';
  var _dev_dir    = '_dev';
  var _img_dir    = 'images';
  var _html_dir   = '_posts';


  /**
   * Error notification settings
   */
  function errorAlert(err) {
    $.notify.onError({
      message:  '<%= error.message %>',
      sound:    'Sosumi'
    })(err);
  }


  /**
   * Clean the dist/dev directories
   */
  function clean(args) {
    var forProd = args.forProd;
    var _build_dir = (forProd) ? _dist_dir : _dev_dir;

    del( _build_dir + '/**/*' );
  }


  /**
   * Lints the gulpfile for errors
   */
  gulp.task('lint:gulpfile', function() {
    gulp.src('gulpfile.js')
      .pipe( $.jshint() )
      .pipe( $.jshint.reporter('default') )
      .on( 'error', errorAlert );
  });


  /**
   * Lints the source js files for errors
   */
  gulp.task('lint:src', function() {
    var _src = [
      '/js/**/*.js'
    ];

    gulp.src(_src)
      .pipe( $.jshint() )
      .pipe( $.jshint.reporter('default') )
      .on( 'error', errorAlert );
  });


  /**
   * Lints all the js files for errors
   */
  gulp.task('lint', [
    'lint:gulpfile',
    'lint:src',
    'lint:sass',
  ]);


  /**
   * Concatenates, minifies and renames the source JS files for dist/dev
   */
  function scripts(args) {
    var forProd = args.forProd;
    var matches = glob.sync('js/*');

    if (matches.length) {
      matches.forEach( function(match) {
        var dir     = match.split('/js/')[1];
        var scripts = [
          _src_dir + '/js/' + dir + '/libs/**/*.js',
          _src_dir + '/js/' + dir + '/**/*.js'
        ];

        if (dir === 'footer') {
          // Add any JS from Bower or another location
          // to this `footer_libs` array to concat it into `footer.js`
          // eg: _bower_dir + '/responsive-nav/responsive-nav.min.js'
          var footer_libs = [
          ];

          scripts = footer_libs.concat(scripts);
        }

        gulp.src(scripts)
          .pipe( $.plumber({ errorHandler: errorAlert }) )
          .pipe( $.concat(dir + '.js') )
          .pipe( $.babel() )
          .pipe( forProd ? $.uglify() : $.util.noop() )
          .pipe( forProd ? $.rename(dir + '.min.js') : $.util.noop() )
          .pipe( gulp.dest(forProd ? _dist_dir : _dev_dir ) )
          .pipe( reload({stream:true}) )
          .on( 'error', errorAlert )
          .pipe(
            $.notify({
              message: 'Scripts have been compiled',
              onLast:   true
            })
          );
      });
    }
  }


  /**
   * Compiles and compresses the source Sass files for dist/dev
   */
  function styles(args) {
    var forProd = args.forProd;

    var _sass_opts = {
      outputStyle:  forProd ? 'compressed' : 'expanded',
      sourceComments: !forProd
    };

    var _postcss_opts = [
      // inlineSVG({
      //   path: _img_dir
      // }),
      // inlineB64(),
      prefix({browsers: ['last 3 versions']})
    ];

    if (forProd) _postcss_opts.push(cssnano());

    gulp.src('/_sass/main.scss')
      .pipe( $.plumber({ errorHandler: errorAlert }) )
      .pipe( $.sass(_sass_opts) )
      .on( 'error', function(err) {
        new $.util.PluginError(
          'CSS',
          err,
          {
            showStack: true
          }
        );
      })
      .pipe( forProd ? $.rename({ suffix: '.min' }) : $.util.noop() )
      .pipe( $.postcss(_postcss_opts) )
      .pipe( gulp.dest(forProd ? _dist_dir : _dev_dir) )
      .pipe( reload({stream:true}) )
      .on( 'error', errorAlert )
      .pipe(
        $.notify({
          message:  forProd ? 'Styles have been compiled and minified' : 'Dev styles have been compiled',
          onLast:   true
        })
      );
  }


  function buildFilePath(s) {
    return through.obj(function(file, enc, cb) {
      console.log(file.path)
      var dirname = path.dirname(file.path);
      var extname = path.extname(file.path);
      var filename = path.basename(file.path, extname);

      var permalink = file.post.permalink || file.post.title || filename;

      permalink = permalink.toString().trim().replace(/\s+/g, '-').toLowerCase();

      file.path = path.join(permalink, 'index.html');
      console.log(file.path)

      cb(null, file);
    });
  }


  function getFrontMatter() {
    return through.obj(function(file, enc, cb) {
      return file.frontMatter;
    });
  }


  /**
   * Make prod HTML
   */
  function html(args) {
    var forProd = args.forProd;
    if (forProd) {
      gulp.src(_html_dir + '/*.md')
        .pipe( $.plumber({ errorHandler: errorAlert }) )
        .pipe(frontMatter({
          property: 'post',
          remove: true
        }))
        .pipe($.debug())
        .pipe($.marked())
        .pipe($.liquid({
          locals: getFrontMatter()
        }))
        // .pipe($.cheerio(function($, file) {
        // }))
        .pipe(buildFilePath())
        .pipe(gulp.dest(_dist_dir))
        .on( 'error', errorAlert )
        .pipe(
          $.notify({
            message: 'HTML has been compiled',
            onLast:   true
          })
        );
    } else {
      gulp.src(_html_dir + '/*.html')
        .pipe($.frontMatter({
          property: 'post',
          remove: true
        }))
        .pipe($.marked())
        .pipe($.twig({
          data: post
        }))
        .pipe($.cheerio(function($, file) {
        }))
        .pipe(gulp.dest(_dev_dir));
      reload();
    }
  }


  /**
   * Lint the Sass
   */
  gulp.task('lint:sass', function() {
    gulp.src(['_sass/**/*.scss', '!_sass/vendor/*'])
      .pipe( $.sassLint({
        'merge-default-rules': true
      }) )
      .pipe( $.sassLint.format() )
      .pipe( $.sassLint.failOnError() );
  });


  /**
   * Builds for distribution (staging or production)
   */
  gulp.task('build', function() {
    clean({forProd:true});
    html({forProd:true});
    // styles({forProd:true});
    // scripts({forProd:true});
  });


  /**
   * Builds assets and reloads the page when any php, html, img or dev files change
   */
  gulp.task('watch', function() {
    clean({forProd:false});
    styles({forProd:false});
    html({forProd:false});
    // scripts({forProd:false});

    browserSync.init({
      server: {
        baseDir: _dev_dir
      },
      notify: true
    });

    gulp.watch('_sass/**/*', function() {
      styles({forProd:false});
    });
    gulp.watch(_html_dir + '/**/*', function() {
      html({forProd:false});
    });
    // gulp.watch(_src_dir + '/js/**/*', function() {
    //   scripts({forProd:false});
    // });
  });

  /**
   * Backup default task just triggers a build
   */
  gulp.task('default', [ 'build' ]);

}());
