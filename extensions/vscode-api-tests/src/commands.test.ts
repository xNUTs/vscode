/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import {join} from 'path';
import {commands, workspace, window, Uri} from 'vscode';

suite('commands namespace tests', () => {

	test('getCommands', function(done) {

		let p1 = commands.getCommands().then(commands => {
			let hasOneWithUnderscore = false;
			for (let command of commands) {
				if (command[0] === '_') {
					hasOneWithUnderscore = true;
					break;
				}
			}
			assert.ok(hasOneWithUnderscore);
		}, done);

		let p2 = commands.getCommands(true).then(commands => {
			let hasOneWithUnderscore = false;
			for (let command of commands) {
				if (command[0] === '_') {
					hasOneWithUnderscore = true;
					break;
				}
			}
			assert.ok(!hasOneWithUnderscore);
		}, done);

		Promise.all([p1, p2]).then(() => {
			done();
		}, done);
	});

	test('api-command: workbench.html.preview', function () {

		let registration = workspace.registerTextDocumentContentProvider('speciale', {
			provideTextDocumentContent(uri) {
				return `content of URI <b>${uri.toString()}</b>`;
			}
		});

		let virtualDocumentUri = Uri.parse('speciale://authority/path');

		return commands.executeCommand('vscode.previewHtml', virtualDocumentUri).then(success => {
			assert.ok(success);
			registration.dispose();
		});

	});

	test('editorCommand with extra args', function () {

		let args: IArguments;
		let registration = commands.registerTextEditorCommand('t1', function() {
			args = arguments;
		});

		return workspace.openTextDocument(join(workspace.rootPath, './far.js')).then(doc => {
			return window.showTextDocument(doc).then(editor => {
				return commands.executeCommand('t1', 12345, commands);
			}).then(() => {
				assert.ok(args);
				assert.equal(args.length, 4);
				assert.ok(args[2] === 12345);
				assert.ok(args[3] === commands);
				registration.dispose();
			});
		});

	});
});
