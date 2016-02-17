/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

var gulp = require('gulp');
var filter = require('gulp-filter');
var es = require('event-stream');
var path = require('path');
var tslint = require('gulp-tslint');

var all = [
	'*',
	'build/**/*',
	'extensions/**/*',
	'scripts/**/*',
	'src/**/*',
	'test/**/*'
];

var eolFilter = [
	'**',
	'!ThirdPartyNotices.txt',
	'!LICENSE.txt',
	'!extensions/**/out/**',
	'!**/node_modules/**',
	'!**/fixtures/**',
	'!**/*.{svg,exe,png,scpt,bat,cmd,cur,ttf,woff,eot}',
];

var indentationFilter = [
	'**',
	'!ThirdPartyNotices.txt',
	'!**/*.md',
	'!**/*.yml',
	'!**/lib/**',
	'!**/*.d.ts',
	'!extensions/typescript/server/**',
	'!test/assert.js',
	'!**/package.json',
	'!**/npm-shrinkwrap.json',
	'!**/octicons/**',
	'!**/vs/languages/sass/test/common/example.scss',
	'!**/vs/languages/less/common/parser/less.grammar.txt',
	'!**/vs/languages/css/common/buildscripts/css-schema.xml',
	'!**/vs/base/common/marked/raw.marked.js',
	'!**/vs/base/common/winjs.base.raw.js',
	'!**/vs/base/node/terminateProcess.sh',
	'!**/vs/base/node/terminateProcess.sh',
	'!**/vs/text.js',
	'!**/vs/nls.js',
	'!**/vs/css.js',
	'!**/vs/loader.js',
	'!extensions/**/snippets/**',
	'!extensions/**/syntaxes/**',
	'!extensions/**/themes/**',
];

var copyrightFilter = [
	'**',
	'!**/*.json',
	'!**/*.html',
	'!**/test/**',
	'!**/*.md',
	'!**/*.bat',
	'!**/*.cmd',
	'!resources/win32/bin/code.js',
	'!**/*.sh',
	'!**/*.txt',
	'!src/vs/editor/standalone-languages/swift.ts',
];

var tslintFilter = [
	'src/**/*.ts',
	'extensions/**/*.ts',
	'!**/*.d.ts',
	'!**/typings/**',
	'!**/*.test.ts',
	'!src/vs/editor/standalone-languages/test/**'
];

var copyrightHeader = [
	'/*---------------------------------------------------------------------------------------------',
	' *  Copyright (c) Microsoft Corporation. All rights reserved.',
	' *  Licensed under the MIT License. See License.txt in the project root for license information.',
	' *--------------------------------------------------------------------------------------------*/'
].join('\n');

/**
 * Reports tslint erros in the format:
 * src/helloWorld.c:5:3: warning: implicit declaration of function ‘prinft’
 */
var lintReporter = function (output, file, options) {
	var relativeBase = file.base.substring(file.cwd.length + 1).replace('\\', '/');
	output.forEach(function (e) {
		var message = relativeBase + e.name + ':' + (e.startPosition.line + 1) + ':' + (e.startPosition.character + 1) + ': ' + e.failure;
		console.log('[tslint] ' + message);
	});
};

gulp.task('tslint', function () {
	return gulp.src(all, { base: '.' })
		.pipe(filter(tslintFilter))
		.pipe(tslint({ rulesDirectory: 'node_modules/tslint-microsoft-contrib' }))
		.pipe(tslint.report(lintReporter, {
			summarizeFailureOutput: false,
			emitError: false
		}));
});

var hygiene = exports.hygiene = function (some) {
	var errorCount = 0;

	var eol = es.through(function (file) {
		if (/\r\n?/g.test(file.contents.toString('utf8'))) {
			console.error(file.relative + ': Bad EOL found');
			errorCount++;
		}

		this.emit('data', file);
	});

	var indentation = es.through(function (file) {
		file.contents
			.toString('utf8')
			.split(/\r\n|\r|\n/)
			.forEach(function (line, i) {
				if (/^\s*$/.test(line)) {
					// empty or whitespace lines are OK
				} else if (/^[\t]*[^\s]/.test(line)) {
					// good indent
				} else if (/^[\t]* \*/.test(line)) {
					// block comment using an extra space
				} else {
					console.error(file.relative + '(' + (i + 1) + ',1): Bad whitespace indentation');
					errorCount++;
				}
			});

		this.emit('data', file);
	});

	var copyrights = es.through(function (file) {
		if (file.contents.toString('utf8').indexOf(copyrightHeader) !== 0) {
			console.error(file.relative + ': Missing or bad copyright statement');
			errorCount++;
		}

		this.emit('data', file);
	});

	return gulp.src(some || all, { base: '.' })
		.pipe(filter(function (f) { return !f.stat.isDirectory(); }))
		.pipe(filter(eolFilter))
		.pipe(eol)
		.pipe(filter(indentationFilter))
		.pipe(indentation)
		.pipe(filter(copyrightFilter))
		.pipe(copyrights)
		.pipe(es.through(null, function () {
			if (errorCount > 0) {
				this.emit('error', 'Hygiene failed with ' + errorCount + ' errors. Check \'build/gulpfile.hygiene.js\'.');
			} else {
				this.emit('end');
			}
		}));
};

gulp.task('hygiene', function () {
	return hygiene();
});

// this allows us to run this as a git pre-commit hook
if (require.main === module) {
	var cp = require('child_process');
	cp.exec('git diff --cached --name-only', function (err, out) {
		if (err) {
			console.error();
			console.error(err);
			process.exit(1);
		}

		var some = out
			.split(/\r?\n/)
			.filter(function (l) { return !!l; });

		hygiene(some).on('error', function (err) {
			console.error();
			console.error(err);
			process.exit(1);
		});
	});
}
