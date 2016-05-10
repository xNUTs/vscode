/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {globals} from 'vs/base/common/platform';

// Telemetry endpoint (used in the standalone editor) for hosts that want to collect editor telemetry
export const standaloneEditorTelemetryEndpoint: string = environment('telemetryEndpoint', null);

// Option for hosts to overwrite the worker script url (used in the standalone editor)
export const getCrossOriginWorkerScriptUrl: (workerId: string, label: string) => string = environment('getWorkerUrl', null);

function environment(name: string, fallback: any = false): any {
	if (globals.GlobalEnvironment && globals.GlobalEnvironment.hasOwnProperty(name)) {
		return globals.GlobalEnvironment[name];
	}

	return fallback;
}

export function workersCount(defaultCount: number): number {
	return environment('workersCount', defaultCount);
}
