/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {createDecorator, ServiceIdentifier} from 'vs/platform/instantiation/common/instantiation';
import Event from 'vs/base/common/event';
import {TPromise} from 'vs/base/common/winjs.base';

export const IConfigurationService = createDecorator<IConfigurationService>('configurationService');

export interface IConfigurationService {
	serviceId: ServiceIdentifier<any>;

	/**
	 * Fetches the appropriate section of the configuration JSON file.
	 * This will be an object keyed off the section name.
	 */
	getConfiguration<T>(section?: string): T;

	/**
	 * Similar to #getConfiguration() but ensures that the latest configuration
	 * from disk is fetched.
	 */
	loadConfiguration<T>(section?: string): TPromise<T>;

	/**
	 * Returns iff the workspace has configuration or not.
	 */
	hasWorkspaceConfiguration(): boolean;

	/**
	 * Event that fires when the configuration changes.
	 */
	onDidUpdateConfiguration: Event<IConfigurationServiceEvent>;
}

export interface IConfigurationServiceEvent {
	config: any;
}

export function extractSetting(config: any, settingPath: string): any {
	function accessSetting(config: any, path: string[]): any {
		let current = config;
		for (let i = 0; i < path.length; i++) {
			current = current[path[i]];
			if (!current) {
				return undefined;
			}
		}
		return current;
	}

	let path = settingPath.split('.');
	return accessSetting(config, path);
}