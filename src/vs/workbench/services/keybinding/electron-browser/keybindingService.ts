/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');
import {TPromise} from 'vs/base/common/winjs.base';
import {IJSONSchema} from 'vs/base/common/jsonSchema';
import {IHTMLContentElement} from 'vs/base/common/htmlContent';
import {Registry} from 'vs/platform/platform';
import {IEventService} from 'vs/platform/event/common/event';
import * as JSONContributionRegistry from 'vs/platform/jsonschemas/common/jsonContributionRegistry';
import {ITelemetryService} from 'vs/platform/telemetry/common/telemetry';
import {IWorkspaceContextService} from 'vs/platform/workspace/common/workspace';
import {PluginsRegistry, IMessageCollector} from 'vs/platform/plugins/common/pluginsRegistry';
import {IPluginService} from 'vs/platform/plugins/common/plugins';
import {IOSupport} from 'vs/platform/keybinding/common/keybindingResolver';
import {KeybindingService} from 'vs/platform/keybinding/browser/keybindingServiceImpl';
import {IKeybindingItem, IUserFriendlyKeybinding} from 'vs/platform/keybinding/common/keybindingService';
import {ICommandRule, KeybindingsRegistry} from 'vs/platform/keybinding/common/keybindingsRegistry';
import {Keybinding} from 'vs/base/common/keyCodes';
import * as Platform from 'vs/base/common/platform';
import {getNativeLabelProvider} from 'vs/workbench/services/keybinding/electron-browser/nativeKeymap';
import {OptionsChangeEvent, EventType} from 'vs/workbench/common/events';

interface ContributedKeyBinding {
	command: string;
	key: string;
	when?: string;
	mac?: string;
	linux?: string;
	win?: string;
}

function isContributedKeyBindingsArray(thing: ContributedKeyBinding|ContributedKeyBinding[]): thing is ContributedKeyBinding[] {
	return Array.isArray(thing);
}

function isValidContributedKeyBinding(keyBinding: ContributedKeyBinding, rejects: string[]): boolean {
	if (!keyBinding) {
		rejects.push(nls.localize('nonempty', "expected non-empty value."));
		return false;
	}
	if (typeof keyBinding.command !== 'string') {
		rejects.push(nls.localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'command'));
		return false;
	}
	if (typeof keyBinding.key !== 'string') {
		rejects.push(nls.localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'key'));
		return false;
	}
	if (keyBinding.when && typeof keyBinding.when !== 'string') {
		rejects.push(nls.localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'when'));
		return false;
	}
	if (keyBinding.mac && typeof keyBinding.mac !== 'string') {
		rejects.push(nls.localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'mac'));
		return false;
	}
	if (keyBinding.linux && typeof keyBinding.linux !== 'string') {
		rejects.push(nls.localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'linux'));
		return false;
	}
	if (keyBinding.win && typeof keyBinding.win !== 'string') {
		rejects.push(nls.localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'win'));
		return false;
	}
	return true;
}

let keybindingType:IJSONSchema = {
	type: 'object',
	default: { command: '', key: '' },
	properties: {
		command: {
			description: nls.localize('vscode.extension.contributes.keybindings.command', 'Identifier of the command to run when keybinding is triggered.'),
			type: 'string'
		},
		key: {
			description: nls.localize('vscode.extension.contributes.keybindings.key', 'Key or key sequence (separate keys with plus-sign and sequences with space, e.g Ctrl+O and Ctrl+L L for a chord'),
			type: 'string'
		},
		mac: {
			description: nls.localize('vscode.extension.contributes.keybindings.mac', 'Mac specific key or key sequence.'),
			type: 'string'
		},
		linux: {
			description: nls.localize('vscode.extension.contributes.keybindings.linux', 'Linux specific key or key sequence.'),
			type: 'string'
		},
		win: {
			description: nls.localize('vscode.extension.contributes.keybindings.win', 'Windows specific key or key sequence.'),
			type: 'string'
		},
		when: {
			description: nls.localize('vscode.extension.contributes.keybindings.when', 'Condition when the key is active.'),
			type: 'string'
		}
	}
};

let keybindingsExtPoint = PluginsRegistry.registerExtensionPoint<ContributedKeyBinding | ContributedKeyBinding[]>('keybindings', {
	description: nls.localize('vscode.extension.contributes.keybindings', "Contributes keybindings."),
	oneOf: [
		keybindingType,
		{
			type: 'array',
			items: keybindingType
		}
	]
});

export class WorkbenchKeybindingService extends KeybindingService {

	private contextService: IWorkspaceContextService;
	private eventService: IEventService;
	private telemetryService: ITelemetryService;
	private toDispose: Function;
	private _pluginService: IPluginService;
	private _eventService: IEventService;

	constructor(contextService: IWorkspaceContextService, eventService: IEventService, telemetryService: ITelemetryService, domNode: HTMLElement) {
		this.contextService = contextService;
		super(domNode);
		this.eventService = eventService;
		this.telemetryService = telemetryService;
		this.toDispose = this.eventService.addListener(EventType.WORKBENCH_OPTIONS_CHANGED, (e) => this.onOptionsChanged(e));
		this._eventService = eventService;
		keybindingsExtPoint.setHandler((extensions) => {
			let commandAdded = false;

			for (let extension of extensions) {
				commandAdded = this._handleKeybindingsExtensionPointUser(extension.description.isBuiltin, extension.value, extension.collector) || commandAdded;
			}

			if (commandAdded) {
				this.updateResolver();
			}
		});
	}

	setPluginService(pluginService: IPluginService): void {
		this._pluginService = pluginService;
	}

	public customKeybindingsCount(): number {
		let opts = this.contextService.getOptions();
		if (opts.globalSettings && opts.globalSettings.keybindings && Array.isArray(opts.globalSettings.keybindings)) {
			return opts.globalSettings.keybindings.length;
		}
		return 0;
	}

	protected _getExtraKeybindings(isFirstTime: boolean): IKeybindingItem[] {
		let extras: IUserFriendlyKeybinding[] = [];
		let opts = this.contextService.getOptions();
		if (opts.globalSettings && opts.globalSettings.keybindings) {
			if (!isFirstTime) {
				let cnt = 0;
				if (Array.isArray(opts.globalSettings.keybindings)) {
					cnt = opts.globalSettings.keybindings.length;
				}
				this.telemetryService.publicLog('customKeybindingsChanged', {
					keyCount: cnt
				});
			}
			if (Array.isArray(opts.globalSettings.keybindings)) {
				extras = opts.globalSettings.keybindings;
			}
		}
		return extras.map((k, i) => IOSupport.readKeybindingItem(k, i));
	}

	private onOptionsChanged(e: OptionsChangeEvent): void {
		if (e.key === 'globalSettings') {
			this.updateResolver();
		}
	}

	public dispose(): void {
		this.toDispose();
	}

	public getLabelFor(keybinding:Keybinding): string {
		return keybinding.toCustomLabel(getNativeLabelProvider());
	}

	public getHTMLLabelFor(keybinding:Keybinding): IHTMLContentElement[] {
		return keybinding.toCustomHTMLLabel(getNativeLabelProvider());
	}

	public getElectronAcceleratorFor(keybinding:Keybinding): string {
		if (Platform.isWindows) {
			// electron menus always do the correct rendering on Windows
			return super.getElectronAcceleratorFor(keybinding);
		}

		let usLabel = keybinding._toUSLabel();
		let label = this.getLabelFor(keybinding);
		if (usLabel !== label) {
			// electron menus are incorrect in rendering (linux) and in rendering and interpreting (mac)
			// for non US standard keyboard layouts
			return null;
		}

		return super.getElectronAcceleratorFor(keybinding);
	}

	private _handleKeybindingsExtensionPointUser(isBuiltin: boolean, keybindings:ContributedKeyBinding | ContributedKeyBinding[], collector:IMessageCollector): boolean {
		if (isContributedKeyBindingsArray(keybindings)) {
			let commandAdded = false;
			for (let i = 0, len = keybindings.length; i < len; i++) {
				commandAdded = this._handleKeybinding(isBuiltin, i + 1, keybindings[i], collector) || commandAdded;
			}
			return commandAdded;
		} else {
			return this._handleKeybinding(isBuiltin, 1, keybindings, collector);
		}
	}

	private _handleKeybinding(isBuiltin: boolean, idx:number, keybindings:ContributedKeyBinding, collector:IMessageCollector): boolean {

		let rejects: string[] = [];
		let commandAdded = false;

		if (isValidContributedKeyBinding(keybindings, rejects)) {
			let rule = this._asCommandRule(isBuiltin, idx++, keybindings);
			if (rule) {
				KeybindingsRegistry.registerCommandRule(rule);
				commandAdded = true;
			}
		}

		if (rejects.length > 0) {
			collector.error(nls.localize(
				'invalid.keybindings',
				"Invalid `contributes.{0}`: {1}",
				keybindingsExtPoint.name,
				rejects.join('\n')
			));
		}

		return commandAdded;
	}

	protected _invokeHandler(commandId: string, args: any): TPromise<any> {
		if (this._pluginService) {
			return this._pluginService.activateByEvent('onCommand:' + commandId).then(_ => {
				return super._invokeHandler(commandId, args);
			});
		}
		return TPromise.as(null);
	}

	private _asCommandRule(isBuiltin: boolean, idx:number, binding: ContributedKeyBinding): ICommandRule {

		let {command, when, key, mac, linux, win} = binding;

		let weight: number;
		if (isBuiltin) {
			weight = KeybindingsRegistry.WEIGHT.builtinExtension(idx);
		} else {
			weight = KeybindingsRegistry.WEIGHT.externalExtension(idx);
		}

		let desc = {
			id: command,
			context: IOSupport.readKeybindingContexts(when),
			weight: weight,
			primary: IOSupport.readKeybinding(key),
			mac: mac && { primary: IOSupport.readKeybinding(mac) },
			linux: linux && { primary: IOSupport.readKeybinding(linux) },
			win: win && { primary: IOSupport.readKeybinding(win) }
		};

		if (!desc.primary && !desc.mac && !desc.linux && !desc.win) {
			return;
		}

		return desc;
	}
}

let schemaId = 'vscode://schemas/keybindings';
let schema : IJSONSchema = {
	'id': schemaId,
	'type': 'array',
	'title': nls.localize('keybindings.json.title', "Keybindings configuration"),
	'items': {
		'required': ['key'],
		'type': 'object',
		'default': { 'key': '{{_}}', 'command': '{{_}}', 'when': '{{_}}' },
		'properties': {
			'key': {
				'type': 'string',
				'description': nls.localize('keybindings.json.key', 'Key or key sequence (separated by space)'),
			},
			'command': {
				'description': nls.localize('keybindings.json.command', 'Name of the command to execute'),
			},
			'when': {
				'type': 'string',
				'description': nls.localize('keybindings.json.when', 'Condition when the key is active.')
			}
		}
	}
};

let schemaRegistry = <JSONContributionRegistry.IJSONContributionRegistry>Registry.as(JSONContributionRegistry.Extensions.JSONContribution);
schemaRegistry.registerSchema(schemaId, schema);
schemaRegistry.addSchemaFileAssociation('vscode://defaultsettings/keybindings.json', schemaId);
schemaRegistry.addSchemaFileAssociation('%APP_SETTINGS_HOME%/keybindings.json', schemaId);
