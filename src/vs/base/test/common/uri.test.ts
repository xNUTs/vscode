/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import URI from 'vs/base/common/uri';
import { parse, stringify } from 'vs/base/common/marshalling';
import { normalize } from 'vs/base/common/paths';

suite('URI', () => {
	test('file#toString', () => {
		assert.equal(URI.file('c:/win/path').toString(), 'file:///c%3A/win/path');
		assert.equal(URI.file('C:/win/path').toString(), 'file:///c%3A/win/path');
		assert.equal(URI.file('c:/win/path/').toString(), 'file:///c%3A/win/path/');
		assert.equal(URI.file('/c:/win/path').toString(), 'file:///c%3A/win/path');
		assert.equal(URI.file('c:\\win\\path').toString(), 'file:///c%3A/win/path');
		assert.equal(URI.file('c:\\win/path').toString(), 'file:///c%3A/win/path');
	});

	test('file#path', () => {
		assert.equal(URI.file('c:/win/path').fsPath.replace(/\\/g, '/'), 'c:/win/path');
		assert.equal(URI.file('c:/win/path/').fsPath.replace(/\\/g, '/'), 'c:/win/path/');
		assert.equal(URI.file('C:/win/path').fsPath.replace(/\\/g, '/'), 'c:/win/path');
		assert.equal(URI.file('/c:/win/path').fsPath.replace(/\\/g, '/'), 'c:/win/path');
		assert.equal(URI.file('./c/win/path').fsPath.replace(/\\/g, '/'), '/./c/win/path');
		assert.equal(URI.file('c:\\win\\path').fsPath.replace(/\\/g, '/'), 'c:/win/path');
		assert.equal(URI.file('c:\\win/path').fsPath.replace(/\\/g, '/'), 'c:/win/path');
	});

	test('http#toString', () => {
		assert.equal(URI.create('http', 'www.msft.com', '/my/path').toString(), 'http://www.msft.com/my/path');
		assert.equal(URI.create('http', 'www.msft.com', '/my/path').toString(), 'http://www.msft.com/my/path');
		assert.equal(URI.create('http', 'www.MSFT.com', '/my/path').toString(), 'http://www.msft.com/my/path');
		assert.equal(URI.create('http', '', 'my/path').toString(), 'http:my/path');
		assert.equal(URI.create('http', '', '/my/path').toString(), 'http:/my/path');
		assert.equal(URI.create('', '', 'my/path').toString(), 'my/path');
		assert.equal(URI.create('', '', '/my/path').toString(), '/my/path');
		//http://a-test-site.com/#test=true
		assert.equal(URI.create('http', 'a-test-site.com', '/', 'test=true').toString(), 'http://a-test-site.com/?test%3Dtrue');
		assert.equal(URI.create('http', 'a-test-site.com', '/', '', 'test=true').toString(), 'http://a-test-site.com/#test%3Dtrue');
	});

	test('http#toString, encode=FALSE', () => {
		assert.equal(URI.create('http', 'a-test-site.com', '/', 'test=true').toString(true), 'http://a-test-site.com/?test=true');
		assert.equal(URI.create('http', 'a-test-site.com', '/', '', 'test=true').toString(true), 'http://a-test-site.com/#test=true');
		assert.equal(URI.create().withScheme('http').withPath('/api/files/test.me').withQuery('t=1234').toString(true), 'http:/api/files/test.me?t=1234');

		var value = URI.parse('file://shares/pröjects/c%23/#l12');
		assert.equal(value.authority, 'shares');
		assert.equal(value.path, '/pröjects/c#/');
		assert.equal(value.fragment, 'l12');
		assert.equal(value.toString(), 'file://shares/pr%C3%B6jects/c%23/#l12');
		assert.equal(value.toString(true), 'file://shares/pröjects/c%23/#l12');

		var uri2 = URI.parse(value.toString(true));
		var uri3 = URI.parse(value.toString());
		assert.equal(uri2.authority, uri3.authority);
		assert.equal(uri2.path, uri3.path);
		assert.equal(uri2.query, uri3.query);
		assert.equal(uri2.fragment, uri3.fragment);
	});

	test('with', () => {
		assert.equal(URI.create().withScheme('http').withPath('/api/files/test.me').withQuery('t=1234').toString(), 'http:/api/files/test.me?t%3D1234');
		assert.equal(URI.create().with('http', '', '/api/files/test.me', 't=1234', '').toString(), 'http:/api/files/test.me?t%3D1234');
		assert.equal(URI.create().with('https', '', '/api/files/test.me', 't=1234', '').toString(), 'https:/api/files/test.me?t%3D1234');
		assert.equal(URI.create().with('HTTP', '', '/api/files/test.me', 't=1234', '').toString(), 'HTTP:/api/files/test.me?t%3D1234');
		assert.equal(URI.create().with('HTTPS', '', '/api/files/test.me', 't=1234', '').toString(), 'HTTPS:/api/files/test.me?t%3D1234');
		assert.equal(URI.create().with('boo', '', '/api/files/test.me', 't=1234', '').toString(), 'boo:/api/files/test.me?t%3D1234');
	});

	test('parse', () => {
		var value = URI.parse('http:/api/files/test.me?t=1234');
		assert.equal(value.scheme, 'http');
		assert.equal(value.authority, '');
		assert.equal(value.path, '/api/files/test.me');
		assert.equal(value.query, 't=1234');
		assert.equal(value.fragment, '');

		value = URI.parse('http://api/files/test.me?t=1234');
		assert.equal(value.scheme, 'http');
		assert.equal(value.authority, 'api');
		assert.equal(value.path, '/files/test.me');
		assert.equal(value.fsPath, normalize('/files/test.me', true));
		assert.equal(value.query, 't=1234');
		assert.equal(value.fragment, '');

		value = URI.parse('file:///c:/test/me');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, '');
		assert.equal(value.path, '/c:/test/me');
		assert.equal(value.fragment, '');
		assert.equal(value.query, '');
		assert.equal(value.fsPath, normalize('c:/test/me', true));

		value = URI.parse('file://shares/files/c%23/p.cs');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, 'shares');
		assert.equal(value.path, '/files/c#/p.cs');
		assert.equal(value.fragment, '');
		assert.equal(value.query, '');
		assert.equal(value.fsPath, normalize('//shares/files/c#/p.cs', true));

		value = URI.parse('file:///c:/Source/Z%C3%BCrich%20or%20Zurich%20(%CB%88zj%CA%8A%C9%99r%C9%AAk,/Code/resources/app/plugins/c%23/plugin.json');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, '');
		assert.equal(value.path, '/c:/Source/Zürich or Zurich (ˈzjʊərɪk,/Code/resources/app/plugins/c#/plugin.json');
		assert.equal(value.fragment, '');
		assert.equal(value.query, '');

		value = URI.parse('file:///c:/test %25/path');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, '');
		assert.equal(value.path, '/c:/test %/path');
		assert.equal(value.fragment, '');
		assert.equal(value.query, '');

		value = URI.parse('inmemory:');
		assert.equal(value.scheme, 'inmemory');
		assert.equal(value.authority, '');
		assert.equal(value.path, '');
		assert.equal(value.query, '');
		assert.equal(value.fragment, '');

		value = URI.parse('api/files/test');
		assert.equal(value.scheme, '');
		assert.equal(value.authority, '');
		assert.equal(value.path, 'api/files/test');
		assert.equal(value.query, '');
		assert.equal(value.fragment, '');

		value = URI.parse('api');
		assert.equal(value.scheme, '');
		assert.equal(value.authority, '');
		assert.equal(value.path, 'api');
		assert.equal(value.query, '');
		assert.equal(value.fragment, '');

		value = URI.parse('/api/files/test');
		assert.equal(value.scheme, '');
		assert.equal(value.authority, '');
		assert.equal(value.path, '/api/files/test');
		assert.equal(value.query, '');
		assert.equal(value.fragment, '');

		value = URI.parse('?test');
		assert.equal(value.scheme, '');
		assert.equal(value.authority, '');
		assert.equal(value.path, '');
		assert.equal(value.query, 'test');
		assert.equal(value.fragment, '');

		value = URI.parse('file:?q');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, '');
		assert.equal(value.path, '');
		assert.equal(value.query, 'q');
		assert.equal(value.fragment, '');

		value = URI.parse('#test');
		assert.equal(value.scheme, '');
		assert.equal(value.authority, '');
		assert.equal(value.path, '');
		assert.equal(value.query, '');
		assert.equal(value.fragment, 'test');

		value = URI.parse('file:#d');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, '');
		assert.equal(value.path, '');
		assert.equal(value.query, '');
		assert.equal(value.fragment, 'd');
	});

	test('parse, disallow //path when no authority', () => {
		assert.throws(() => URI.parse('file:////shares/files/p.cs'));
	});

	// Useful reference:
	test('correctFileUriToFilePath', () => {

		var test = (input: string, expected: string) => {
			expected = normalize(expected, true);
			assert.equal(URI.parse(input).fsPath, expected, 'Result for ' + input);
		};

		test('file:///c:/alex.txt', 'c:\\alex.txt');
		test('file:///c:/Source/Z%C3%BCrich%20or%20Zurich%20(%CB%88zj%CA%8A%C9%99r%C9%AAk,/Code/resources/app/plugins',
			'c:\\Source\\Zürich or Zurich (ˈzjʊərɪk,\\Code\\resources\\app\\plugins');
		test('file://monacotools/isi.txt', '\\\\monacotools\\isi.txt');
		test('file://monacotools1/certificates/SSL/', '\\\\monacotools1\\certificates\\SSL\\');
	});

	test('URI#file', () => {

		var value = URI.file('\\\\shäres\\path\\c#\\plugin.json');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, 'shäres');
		assert.equal(value.path, '/path/c#/plugin.json');
		assert.equal(value.fragment, '');
		assert.equal(value.query, '');
		assert.equal(value.toString(), 'file://sh%C3%A4res/path/c%23/plugin.json');

		// identity toString -> parse -> toString
		value = URI.parse(value.toString());
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, 'shäres');
		assert.equal(value.path, '/path/c#/plugin.json');
		assert.equal(value.fragment, '');
		assert.equal(value.query, '');
		assert.equal(value.toString(), 'file://sh%C3%A4res/path/c%23/plugin.json');

		value = URI.file('\\\\localhost\\c$\\GitDevelopment\\express');
		assert.equal(value.scheme, 'file');
		assert.equal(value.path, '/c$/GitDevelopment/express');
		assert.equal(value.fsPath, normalize('//localhost/c$/GitDevelopment/express', true));
		assert.equal(value.query, '');
		assert.equal(value.fragment, '');
		assert.equal(value.toString(), 'file://localhost/c%24/GitDevelopment/express');

		value = URI.file('c:\\test with %\\path');
		assert.equal(value.path, '/c:/test with %/path');
		assert.equal(value.toString(), 'file:///c%3A/test%20with%20%25/path');

		value = URI.file('c:\\test with %25\\path');
		assert.equal(value.path, '/c:/test with %25/path');
		assert.equal(value.toString(), 'file:///c%3A/test%20with%20%2525/path');

		value = URI.file('c:\\test with %25\\c#code');
		assert.equal(value.path, '/c:/test with %25/c#code');
		assert.equal(value.toString(), 'file:///c%3A/test%20with%20%2525/c%23code');

		value = URI.file('\\\\shares');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, 'shares');
		assert.equal(value.path, '/'); // slash is always there

		value = URI.file('\\\\shares\\');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, 'shares');
		assert.equal(value.path, '/');

		// we don't complain here
		value = URI.file('file://path/to/file');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, '');
		assert.equal(value.path, '/file://path/to/file');
	});

	test('URI#file, auto-slash windows drive letter', () => {

		var value = URI.file('c:\\test\\drive');
		assert.equal(value.path, '/c:/test/drive');
		assert.equal(value.toString(), 'file:///c%3A/test/drive');
	});

	test('URI#file, always slash', () => {

		var value = URI.file('a.file');
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, '');
		assert.equal(value.path, '/a.file');
		assert.equal(value.toString(), 'file:///a.file');

		value = URI.parse(value.toString());
		assert.equal(value.scheme, 'file');
		assert.equal(value.authority, '');
		assert.equal(value.path, '/a.file');
		assert.equal(value.toString(), 'file:///a.file');
	});

	test('URI.toString, only scheme and query', () => {
		var value = URI.parse('stuff:?qüery');
		assert.equal(value.toString(), 'stuff:?q%C3%BCery');
	});

	test('URI#toString, upper-case percent espaces', () => {
		var value = URI.parse('file://sh%c3%a4res/path');
		assert.equal(value.toString(), 'file://sh%C3%A4res/path');
	});

	test('URI#toString, escape all the bits', () => {

		var value = URI.file('/Users/jrieken/Code/_samples/18500/Mödel + Other Thîngß/model.js');
		assert.equal(value.toString(), 'file:///Users/jrieken/Code/_samples/18500/M%C3%B6del%20%2B%20Other%20Th%C3%AEng%C3%9F/model.js');
	});

	test('URI#toString, don\'t encode port', () => {
		var value = URI.parse('http://localhost:8080/far');
		assert.equal(value.toString(), 'http://localhost:8080/far');

		value = URI.create('http', 'löcalhost:8080', '/far', undefined, undefined);
		assert.equal(value.toString(), 'http://l%C3%B6calhost:8080/far');
	});

	test('correctFileUriToFilePath2', () => {

		var test = (input: string, expected: string) => {
			expected = normalize(expected, true);
			var value = URI.parse(input);
			assert.equal(value.fsPath, expected, 'Result for ' + input);
			var value2 = URI.file(value.fsPath);
			assert.equal(value2.fsPath, expected, 'Result for ' + input);
			assert.equal(value.toString(), value2.toString());
		};

		test('file:///c:/alex.txt', 'c:\\alex.txt');
		test('file:///c:/Source/Z%C3%BCrich%20or%20Zurich%20(%CB%88zj%CA%8A%C9%99r%C9%AAk,/Code/resources/app/plugins',
			'c:\\Source\\Zürich or Zurich (ˈzjʊərɪk,\\Code\\resources\\app\\plugins');
		test('file://monacotools/isi.txt', '\\\\monacotools\\isi.txt');
		test('file://monacotools1/certificates/SSL/', '\\\\monacotools1\\certificates\\SSL\\');
	});

	test('Bug 16793:# in folder name => mirror models get out of sync', () => {
		var uri1 = URI.file('C:\\C#\\file.txt');
		assert.equal(parse(stringify(uri1)).toString(), uri1.toString());
	});


	test('URI - (de)serialize', function() {

		var values = [
			URI.parse('http://localhost:8080/far'),
			URI.file('c:\\test with %25\\c#code'),
			URI.file('\\\\shäres\\path\\c#\\plugin.json'),
			URI.parse('http://api/files/test.me?t=1234'),
			URI.parse('http://api/files/test.me?t=1234#fff'),
			URI.parse('http://api/files/test.me#fff'),
		];

		// console.profile();
		// let c = 100000;
		// while (c-- > 0) {
		for(let value of values) {
			let data = value.toJSON();
			let clone = URI.revive(data);

			assert.equal(clone.scheme, value.scheme);
			assert.equal(clone.authority, value.authority);
			assert.equal(clone.path, value.path);
			assert.equal(clone.query, value.query);
			assert.equal(clone.fragment, value.fragment);
			assert.equal(clone.fsPath, value.fsPath);
			assert.equal(clone.toString(), value.toString());
		}
		// }
		// console.profileEnd();
	});

	test('URI - http, query & toString', function() {

		let uri = URI.parse('https://go.microsoft.com/fwlink/?LinkId=518008');
		assert.equal(uri.query, 'LinkId=518008');
		assert.equal(uri.toString(true), 'https://go.microsoft.com/fwlink/?LinkId=518008');
		assert.equal(uri.toString(), 'https://go.microsoft.com/fwlink/?LinkId%3D518008');

		let uri2 = URI.parse(uri.toString());
		assert.equal(uri2.query, 'LinkId=518008');
		assert.equal(uri2.query, uri.query);

		uri = URI.parse('https://go.microsoft.com/fwlink/?LinkId=518008&foö&ké¥=üü');
		assert.equal(uri.query, 'LinkId=518008&foö&ké¥=üü');
		assert.equal(uri.toString(true), 'https://go.microsoft.com/fwlink/?LinkId=518008&foö&ké¥=üü');
		assert.equal(uri.toString(), 'https://go.microsoft.com/fwlink/?LinkId%3D518008%26fo%C3%B6%26k%C3%A9%C2%A5%3D%C3%BC%C3%BC');

		uri2 = URI.parse(uri.toString());
		assert.equal(uri2.query, 'LinkId=518008&foö&ké¥=üü');
		assert.equal(uri2.query, uri.query);
	});
});