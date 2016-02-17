/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/panelPart';
import nls = require('vs/nls');
import {TPromise, Promise} from 'vs/base/common/winjs.base';
import {KeyMod, KeyCode, CommonKeybindings} from 'vs/base/common/keyCodes';
import strings = require('vs/base/common/strings');
import {Action, IAction} from 'vs/base/common/actions';
import {Builder} from 'vs/base/browser/builder';
import dom = require('vs/base/browser/dom');
import {Registry} from 'vs/platform/platform';
import {Scope} from 'vs/workbench/browser/actionBarRegistry';
import {SyncActionDescriptor} from 'vs/platform/actions/common/actions';
import {IWorkbenchActionRegistry, Extensions as WorkbenchExtensions} from 'vs/workbench/common/actionRegistry';
import {IPanel} from 'vs/workbench/common/panel';
import {EventType as WorkbenchEventType, CompositeEvent} from 'vs/workbench/common/events';
import {CompositePart} from 'vs/workbench/browser/parts/compositePart';
import {Panel, PanelRegistry, Extensions as PanelExtensions} from 'vs/workbench/browser/panel';
import {IPanelService} from 'vs/workbench/services/panel/common/panelService';
import {IPartService} from 'vs/workbench/services/part/common/partService';
import {IStorageService, StorageScope} from 'vs/platform/storage/common/storage';
import {IContextMenuService} from 'vs/platform/contextview/browser/contextView';
import {IEventService} from 'vs/platform/event/common/event';
import {IMessageService, Severity} from 'vs/platform/message/common/message';
import {ITelemetryService} from 'vs/platform/telemetry/common/telemetry';
import {IWorkspaceContextService} from 'vs/workbench/services/workspace/common/contextService';
import {IKeybindingService} from 'vs/platform/keybinding/common/keybindingService';

export class PanelPart extends CompositePart<Panel> implements IPanelService {

	public static activePanelSettingsKey = 'workbench.panelpart.activepanelid';

	public serviceId = IPanelService;
	private blockOpeningPanel: boolean;

	constructor(
		messageService: IMessageService,
		storageService: IStorageService,
		eventService: IEventService,
		telemetryService: ITelemetryService,
		contextMenuService: IContextMenuService,
		partService: IPartService,
		keybindingService: IKeybindingService,
		id: string
	) {
		super(
			messageService,
			storageService,
			eventService,
			telemetryService,
			contextMenuService,
			partService,
			keybindingService,
			(<PanelRegistry>Registry.as(PanelExtensions.Panels)),
			PanelPart.activePanelSettingsKey,
			'panel',
			'panel',
			Scope.PANEL,
			id
		);
	}

	public create(parent: Builder): void {
		super.create(parent);
		
		dom.addStandardDisposableListener(this.getContainer().getHTMLElement(), 'keyup', (e: dom.IKeyboardEvent) => {
			if (e.equals(CommonKeybindings.ESCAPE)) {
				this.partService.setPanelHidden(true);
				e.preventDefault();
			}
		});
	}

	public openPanel(id: string, focus?: boolean): TPromise<Panel> {
		if (this.blockOpeningPanel) {
			return TPromise.as(null); // Workaround against a potential race condition
		}

		// First check if panel is hidden and show if so
		if (this.partService.isPanelHidden()) {
			try {
				this.blockOpeningPanel = true;
				this.partService.setPanelHidden(false);
			} finally {
				this.blockOpeningPanel = false;
			}
		}

		return this.openComposite(id, focus);
	}

	protected getActions(): IAction[] {
		return [this.instantiationService.createInstance(ClosePanelAction, ClosePanelAction.ID, ClosePanelAction.LABEL)]
	}

	public getActivePanel(): IPanel {
		return this.getActiveComposite();
	}

	public getLastActivePanelId(): string {
		return this.getLastActiveCompositetId();
	}

	public hideActivePanel(): TPromise<void> {
		return this.hideActiveComposite();
	}
}


class ClosePanelAction extends Action {
	static ID = 'workbench.action.closePanel';
	static LABEL = nls.localize('closePanel', "Close");

	constructor(
		id: string,
		name: string,
		@IPartService private partService: IPartService
	) {
		super(id, name, 'close-editor-action');
	}

	public run(): Promise {
		this.partService.setPanelHidden(true);
		return Promise.as(true);
	}
}

class TogglePanelAction extends Action {
	static ID = 'workbench.action.togglePanel';
	static LABEL = nls.localize('togglePanel', "Toggle Panel Visibility");

	constructor(
		id: string,
		name: string,
		@IPartService private partService: IPartService
	) {
		super(id, name, null);
	}

	public run(): Promise {
		this.partService.setPanelHidden(!this.partService.isPanelHidden());
		return Promise.as(true);
	}
}

let actionRegistry = <IWorkbenchActionRegistry>Registry.as(WorkbenchExtensions.WorkbenchActions);
actionRegistry.registerWorkbenchAction(new SyncActionDescriptor(TogglePanelAction, TogglePanelAction.ID, TogglePanelAction.LABEL, { primary: KeyMod.CtrlCmd | KeyCode.KEY_J }), nls.localize('view', "View"));
