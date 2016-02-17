/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {Promise, TPromise} from 'vs/base/common/winjs.base';
import nls = require('vs/nls');
import {Registry} from 'vs/platform/platform';
import arrays = require('vs/base/common/arrays');
import {IDisposable} from 'vs/base/common/lifecycle';
import {IAction, Action} from 'vs/base/common/actions';
import {EditorAction, Behaviour} from 'vs/editor/common/editorAction';
import {ICommonCodeEditor, IEditorActionDescriptorData} from 'vs/editor/common/editorCommon';
import {IOutputChannelRegistry, Extensions, IOutputService, OUTPUT_MODE_ID, OUTPUT_PANEL_ID} from 'vs/workbench/parts/output/common/output';
import {OutputEditorInput} from 'vs/workbench/parts/output/common/outputEditorInput';
import {SelectActionItem} from 'vs/base/browser/ui/actionbar/actionbar';
import {IPartService} from 'vs/workbench/services/part/common/partService';
import {IPanelService} from 'vs/workbench/services/panel/common/panelService';

export class ToggleOutputAction extends Action {

	public static ID = 'workbench.action.output.toggleOutput';
	public static LABEL = nls.localize('toggleOutput', "Toggle Output");

	constructor(
		id: string, label: string,
		@IPartService private partService: IPartService,
		@IPanelService private panelService: IPanelService,
		@IOutputService private outputService: IOutputService
	) {
		super(id, label);
	}

	public run(event?: any): Promise {
		const panel = this.panelService.getActivePanel();
		if (panel && panel.getId() === OUTPUT_PANEL_ID) {
			this.partService.setPanelHidden(true);

			return Promise.as(null);
		}

		return this.outputService.showOutput(this.outputService.getActiveChannel());
	}
}

export class ClearOutputAction extends Action {

	constructor(@IOutputService private outputService: IOutputService) {
		super('workbench.output.action.clearOutput', nls.localize('clearOutput', "Clear Output"), 'output-action clear-output');
	}

	public run(): Promise {
		this.outputService.clearOutput(this.outputService.getActiveChannel());
		return Promise.as(true);
	}
}

export class ClearOutputEditorAction extends EditorAction {

	public static ID = 'editor.action.clearoutput';

	constructor(
		descriptor: IEditorActionDescriptorData,
		editor: ICommonCodeEditor,
		@IOutputService private outputService: IOutputService
	) {
		super(descriptor, editor, Behaviour.WidgetFocus | Behaviour.ShowInContextMenu);
	}

	public getGroupId(): string {
		return 'clear';
	}

	public isSupported(): boolean {
		let model = this.editor.getModel();
		let mode = model && model.getMode();

		return mode && mode.getId() === OUTPUT_MODE_ID && super.isSupported();
	}

	public run(): TPromise<boolean> {
		this.outputService.clearOutput(this.outputService.getActiveChannel());
		return TPromise.as(false);
	}
}

export class SwitchOutputAction extends Action {

	public static ID = 'workbench.output.action.switchBetweenOutputs';

	constructor(@IOutputService private outputService: IOutputService) {
		super(SwitchOutputAction.ID, nls.localize('switchToOutput.label', "Switch to Output"));

		this.class = 'output-action switch-to-output';
	}

	public run(channel?: string): Promise {
		return this.outputService.showOutput(channel);
	}
}

export class SwitchOutputActionItem extends SelectActionItem {
	private input: OutputEditorInput;
	private outputListenerDispose: IDisposable;

	constructor(
		action: IAction,
		@IOutputService private outputService: IOutputService
	) {
		super(null, action, SwitchOutputActionItem.getChannels(outputService), Math.max(0, SwitchOutputActionItem.getChannels(outputService).indexOf(outputService.getActiveChannel())));

		this.outputListenerDispose = this.outputService.onOutputChannel(this.onOutputChannel, this);
	}

	private onOutputChannel(): void {
		let channels = SwitchOutputActionItem.getChannels(this.outputService);
		let selected = Math.max(0, channels.indexOf(this.outputService.getActiveChannel()));

		this.setOptions(channels, selected);
	}

	private static getChannels(outputService: IOutputService): string[] {
		const contributedChannels = (<IOutputChannelRegistry>Registry.as(Extensions.OutputChannels)).getChannels();
		const usedChannels = outputService.getChannels();

		return arrays.distinct(contributedChannels.concat(usedChannels)).sort(); // sort by name
	}

	public dispose(): void {
		super.dispose();

		if (this.outputListenerDispose) {
			this.outputListenerDispose.dispose();
			delete this.outputListenerDispose;
		}

		delete this.input;
	}
}