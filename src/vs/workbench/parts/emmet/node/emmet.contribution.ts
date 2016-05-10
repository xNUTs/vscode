/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import nls = require('vs/nls');

import {Registry} from 'vs/platform/platform';
import {CommonEditorRegistry, EditorActionDescriptor} from 'vs/editor/common/editorCommonExtensions';
import {IConfigurationRegistry, Extensions as ConfigurationExtensions} from 'vs/platform/configuration/common/configurationRegistry';

import editorCommon = require('vs/editor/common/editorCommon');
import {ExpandAbbreviationAction} from './emmetActions';
import {KeybindingsRegistry} from 'vs/platform/keybinding/common/keybindingsRegistry';
import {KeyCode} from 'vs/base/common/keyCodes';
import {KbExpr} from 'vs/platform/keybinding/common/keybindingService';

CommonEditorRegistry.registerEditorAction(new EditorActionDescriptor(ExpandAbbreviationAction,
	ExpandAbbreviationAction.ID,
	nls.localize('expandAbbreviationAction',
	"Emmet: Expand Abbreviation"), void 0, 'Emmet: Expand Abbreviation'));

KeybindingsRegistry.registerCommandRule({
	id: ExpandAbbreviationAction.ID,
	weight: KeybindingsRegistry.WEIGHT.editorContrib(),
	when: KbExpr.and(
		KbExpr.has(editorCommon.KEYBINDING_CONTEXT_EDITOR_TEXT_FOCUS),
		KbExpr.not(editorCommon.KEYBINDING_CONTEXT_EDITOR_HAS_NON_EMPTY_SELECTION),
		KbExpr.not(editorCommon.KEYBINDING_CONTEXT_EDITOR_HAS_MULTIPLE_SELECTIONS),
		KbExpr.not(editorCommon.KEYBINDING_CONTEXT_EDITOR_TAB_MOVES_FOCUS),
		KbExpr.has('config.emmet.triggerExpansionOnTab')
	),
	primary: KeyCode.Tab
});

// Configuration: emmet
const configurationRegistry = <IConfigurationRegistry>Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'emmet',
	'order': 7,
	'title': nls.localize('emmetConfigurationTitle', "Emmet configuration"),
	'type': 'object',
	'properties': {
		'emmet.triggerExpansionOnTab': {
			'type': 'boolean',
			'default': true,
			'description': nls.localize('triggerExpansionOnTab', "When enabled, emmet abbreviations are expanded when pressing TAB.")
		}
	}
});