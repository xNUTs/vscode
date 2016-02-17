/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {IEventEmitter} from 'vs/base/common/eventEmitter';
import {IAction, IActionItem} from 'vs/base/common/actions';
import {ISelection} from 'vs/platform/selection/common/selection';

export interface IComposite {

	/**
	 * Returns the unique identifier of this composite.
	 */
	getId(): string;

	/**
	 * Returns the name of this composite to show in the title area.
	 */
	getTitle(): string;

	/**
	 * Returns the primary actions of the composite.
	 */
	getActions(): IAction[];

	/**
	 * Returns the secondary actions of the composite.
	 */
	getSecondaryActions(): IAction[];

	/**
	 * Returns the action item for a specific action.
	 */
	getActionItem(action: IAction): IActionItem;

	/**
	 * Returns the underlying control of this composite.
	 */
	getControl(): IEventEmitter;

	/**
	 * Returns the selection of this composite.
	 */
	getSelection(): ISelection;

	/**
	 * Asks the underlying control to focus.
	 */
	focus(): void;
}
