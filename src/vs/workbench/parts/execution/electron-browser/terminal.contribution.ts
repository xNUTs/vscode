/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');
import {TPromise} from 'vs/base/common/winjs.base';
import {Registry} from 'vs/platform/platform';
import baseplatform = require('vs/base/common/platform');
import {IAction, Action} from 'vs/base/common/actions';
import {IWorkbenchActionRegistry, Extensions as ActionExtensions} from 'vs/workbench/common/actionRegistry';
import paths = require('vs/base/common/paths');
import {Scope, IActionBarRegistry, Extensions as ActionBarExtensions, ActionBarContributor} from 'vs/workbench/browser/actionBarRegistry';
import uri from 'vs/base/common/uri';
import {asFileResource} from 'vs/workbench/parts/files/common/files';
import {IWorkspaceContextService} from 'vs/workbench/services/workspace/common/contextService';
import {ITerminalService} from 'vs/workbench/parts/execution/common/execution';
import {SyncActionDescriptor} from 'vs/platform/actions/common/actions';
import {IInstantiationService} from 'vs/platform/instantiation/common/instantiation';
import {IWorkbenchEditorService} from 'vs/workbench/services/editor/common/editorService';
import {asFileEditorInput} from 'vs/workbench/common/editor';
import {KeyMod, KeyCode} from 'vs/base/common/keyCodes';
import {Extensions, IConfigurationRegistry} from 'vs/platform/configuration/common/configurationRegistry';
import {DEFAULT_TERMINAL_WINDOWS, DEFAULT_TERMINAL_LINUX} from 'vs/workbench/parts/execution/electron-browser/terminal';

let configurationRegistry = <IConfigurationRegistry>Registry.as(Extensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'externalTerminal',
	'order': 100,
	'title': nls.localize('terminalConfigurationTitle', "External terminal configuration"),
	'type': 'object',
	'properties': {
		'externalTerminal.windowsExec': {
			'type': 'string',
			'description': nls.localize('externalTerminal.windowsExec', "Customizes which terminal to run on Windows."),
			'default': DEFAULT_TERMINAL_WINDOWS
		},
		'externalTerminal.linuxExec': {
			'type': 'string',
			'description': nls.localize('externalTerminal.linuxExec', "Customizes which terminal to run on Linux."),
			'default': DEFAULT_TERMINAL_LINUX
		}
	}
});

export class OpenConsoleAction extends Action {

	public static ID = 'workbench.action.terminal.openNativeConsole';
	public static Label = baseplatform.isWindows ? nls.localize('globalConsoleActionWin', "Open New Command Prompt") :
		nls.localize('globalConsoleActionMacLinux', "Open New Terminal");
	public static ScopedLabel = baseplatform.isWindows ? nls.localize('scopedConsoleActionWin', "Open in Command Prompt") :
		nls.localize('scopedConsoleActionMacLinux', "Open in Terminal");

	private resource: uri;

	constructor(
		id: string,
		label: string,
		@ITerminalService private terminalService: ITerminalService,
		@IWorkbenchEditorService private editorService: IWorkbenchEditorService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService
	) {
		super(id, label);

		this.order = 49; // Allow other actions to position before or after
	}

	public setResource(resource: uri): void {
		this.resource = resource;
		this.enabled = !paths.isUNC(this.resource.fsPath);
	}

	public run(event?: any): TPromise<any> {
		let pathToOpen: string;

		// Try workspace path first
		let workspace = this.contextService.getWorkspace();
		pathToOpen = this.resource ? this.resource.fsPath : (workspace && workspace.resource.fsPath);

		// Otherwise check if we have an active file open
		if (!pathToOpen) {
			const file = asFileEditorInput(this.editorService.getActiveEditorInput(), true);
			if (file) {
				pathToOpen = paths.dirname(file.getResource().fsPath); // take parent folder of file
			}
		}

		this.terminalService.openTerminal(pathToOpen);

		return TPromise.as(null);
	}
}

class FileViewerActionContributor extends ActionBarContributor {

	constructor( @IInstantiationService private instantiationService: IInstantiationService) {
		super();
	}

	public hasSecondaryActions(context: any): boolean {
		return !!asFileResource(context.element);
	}

	public getSecondaryActions(context: any): IAction[] {
		let fileResource = asFileResource(context.element);
		let resource = fileResource.resource;
		if (!fileResource.isDirectory) {
			resource = uri.file(paths.dirname(resource.fsPath));
		}

		let action = this.instantiationService.createInstance(OpenConsoleAction, OpenConsoleAction.ID, OpenConsoleAction.ScopedLabel);
		action.setResource(resource);

		return [action];
	}
}

const actionBarRegistry = <IActionBarRegistry>Registry.as(ActionBarExtensions.Actionbar);
actionBarRegistry.registerActionBarContributor(Scope.VIEWER, FileViewerActionContributor);

// Register Global Action to Open Console
(<IWorkbenchActionRegistry>Registry.as(ActionExtensions.WorkbenchActions)).registerWorkbenchAction(
	new SyncActionDescriptor(
		OpenConsoleAction,
		OpenConsoleAction.ID,
		OpenConsoleAction.Label,
		{ primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_C }
	),
	'Open New Command Prompt'
);
