/*!
loadCSS: load a CSS file asynchronously.
[c]2014 @scottjehl, Filament Group, Inc.
Licensed MIT
*/
function loadCSS( href, before, media, callback ){
	"use strict";
	var ss = window.document.createElement( "link" );
	var ref = before || window.document.getElementsByTagName( "script" )[ 0 ];
	var sheets = window.document.styleSheets;
	ss.rel = "stylesheet";
	ss.href = href;
	ss.media = "only x";
	if( callback ) {
		ss.onload = callback;
	}

	ref.parentNode.insertBefore( ss, ref );
	ss.onloadcssdefined = function( cb ){
		var defined;
		for( var i = 0; i < sheets.length; i++ ){
			if( sheets[ i ].href && sheets[ i ].href.indexOf( href ) > -1 ){
				defined = true;
			}
		}
		if( defined ){
			cb();
		}
		else {
			setTimeout(function() {
				ss.onloadcssdefined( cb );
			});
		}
	};
	ss.onloadcssdefined(function() {
		ss.media = media || "all";
	});
	return ss;
}

// loadCSS( "/css/main.css" );

// Control form fields
var form_boxes = document.querySelectorAll('.mc-field-group, .field-group');

function activate_field(el) {
  el.parentNode.classList.add('active-input');
}

function deactivate_field(el) {
  if ( el.value === '' ) {
    el.parentNode.classList.remove('active-input');
  }
}

Array.prototype.forEach.call(form_boxes, function(el, i) {
  var form_input = el.querySelector('textarea, input');

  deactivate_field(form_input);

  form_input.addEventListener('focus', function(event) {
    activate_field(event.target);
  });
  form_input.addEventListener('change', function(event) {
    activate_field(event.target);
  });
  form_input.addEventListener('blur', function(event) {
    deactivate_field(event.target);
  });
});

function submit_async_form(form) {
  var form_message = document.querySelector('.form-message'),
      url          = form.getAttribute('action'),
      inputs       = form.querySelectorAll('input:not([type="submit"]),textarea'),
      submit       = form.querySelector('input[type="submit"]');

  url = '//api.jdsteinbach.com/mail/';

  submit.addEventListener('click', function(event) {
    event.preventDefault();

    var data = [];
    var data_obj = {};

    Array.prototype.forEach.call(inputs, function(el, i) {
      data.push(el.name + '=' + el.value);
      data_obj[el.name] = el.value;
    });
    data = data.join('&');
    data_obj= JSON.serialize(data_obj);

    console.log(data);
    console.log(data_obj);

    var request = new XMLHttpRequest();

    request.open('POST', 'https:' + url, true);

    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

    request.onload = function() {
      // does onload or onreadystatechange matter??
      form_message.innerHTML = request.responseText;
      if (request.status >= 200 && request.status < 400) {
        // ^ if request.readystate == 4 ??
        // Success!
        form_message.classList.add('success');
        Array.prototype.forEach.call(inputs, function(el, i) {
          el.value = '';
        });
      } else {
        // We reached our target server, but it returned an error
        form_message.classList.add('success');
      }
    };

    request.onerror = function() {
      // There was a connection error of some sort
    };

    request.send(data);

    });
}

var contact_form = document.getElementById('contact-form');
submit_async_form(contact_form);

// (function($) {
//   var $cf = $('#contact-form'),
//       $fm = $('.form-message');

//   if ( $cf.length > 0 ) {
//     $cf.submit(function(e){
//       e.preventDefault();

//       var form_data = $cf.serialize();
//       console.log(form_data);
//       // $.ajax({
//       //   type: 'POST',
//       //   url: $cf.attr('action'),
//       //   data: form_data
//       // })
//       // .done(function(response) {
//       //   $fm.removeClass('error').addClass('success').html(response);
//       //   $('#name').val('');
//       //   $('#email').val('');
//       //   $('#message').val('');
//       // })
//       // .fail(function(data) {
//       //   $fm.removeClass('success').addClass('error');
//       //   if (data.responseText !== '') {
//       //     $fm.html(data.responseText);
//       //   } else {
//       //     $fm.html('<p>Sorry, an error occured and your message could not be sent.</p>');
//       //   }
//       // });
//     });
//   }
// })(jQuery);