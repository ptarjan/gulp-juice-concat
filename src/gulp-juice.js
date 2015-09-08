var through = require('through2');
var juice = require('juice');
var gutil = require('gulp-util');
var path = require('path');
var PluginError = gutil.PluginError;
var File = gutil.File;
var util = require('util');
var cheerio = require('cheerio');
var fs = require('fs');
var _ = require('lodash');

function externalCSSToInline(contents) {
	return util.format("<style type='text/css'>%s</style>", contents);
}

function injectCSS(html, css) {
	html('head').append(externalCSSToInline(css));
	return html;
}

var PLUGIN_NAME = 'gulp-plugin-concat';

function gulpJuiceStream(conf) {
	conf = conf || {};
	// Creating a stream through which each file will pass

	var htmlFiles = [];

  var stream = function (file, enc, cb) {
    if (file.isNull()) {
      	this.push(file); // Do nothing if no contents
    	return cb();
    }

    if (file.isStream()) {
    	return cb(new PluginError(PLUGIN_NAME, 'Streaming not supported'));
    }

  	if (path.extname(file.path) === '.html') {
    	htmlFiles.push(file);
    } else {
    	return cb(null, file);
    }

  	return cb();


	};

	var absolutePathFromRelativeHTTP = function (htmlPath, relativePath) {
		var htmlDir = path.dirname(htmlPath);
		if (/^\//.test(relativePath)) {
			return htmlDir + relativePath;
		} else {
			return htmlDir + '/' + relativePath;
		}

	};

	var endStream = function (cb) {

		if (htmlFiles.length > 0) {
			_.forEach(htmlFiles, function(file) {
				var contents = file.contents.toString();
				var css = [];

				// Cheerio this and get the style tags
				var $ = cheerio.load(contents);
				$('link,style').each(function() {
					var data;
					var elem = $(this);

					if (elem.is('link') && elem.attr('rel') == 'stylesheet' && elem.attr('href')) {
						// Need to get the contents of the path
						var path = absolutePathFromRelativeHTTP(file.path, elem.attr('href'));

						if (fs.existsSync(path)) {
							data = fs.readFileSync(path, {  encoding: 'utf-8' } );
						} else {
							gutil.log('File at `%s` does not exist', path);
						}

					} else {
							data = elem.text();
					}

					$(this).remove();

					css.push(data);

				});

				if (css.length > 0) {
					$ = injectCSS($, css.join(''));
					contents = juice($.html(), conf);
					file.contents = new Buffer(contents);
				}

				this.push(file);

			}.bind(this));
		}
		cb();
	};

	// returning the file stream
	return through.obj(stream, endStream);
}

module.exports = gulpJuiceStream;
