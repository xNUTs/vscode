/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {notImplemented} from 'vs/base/common/errors';
import {TPromise} from 'vs/base/common/winjs.base';
import {ITelemetryService, ITelemetryInfo} from 'vs/platform/telemetry/common/telemetry';
import {Remotable, IThreadService} from 'vs/platform/thread/common/thread';

/**
 * Helper always instantiated in the main process to receive telemetry events from remote telemetry services
 */
@Remotable.MainContext('RemoteTelemetryServiceHelper')
export class RemoteTelemetryServiceHelper {

	private _telemetryService: ITelemetryService;

	constructor( @ITelemetryService telemetryService: ITelemetryService) {
		this._telemetryService = telemetryService;
	}

	public $publicLog(eventName: string, data?: any): void {
		this._telemetryService.publicLog(eventName, data);
	}

	public $getTelemetryInfo(): TPromise<ITelemetryInfo> {
		return this._telemetryService.getTelemetryInfo();
	}
}

export class RemoteTelemetryService implements ITelemetryService {

	serviceId: any;

	private _name: string;
	private _proxy: RemoteTelemetryServiceHelper;

	constructor(name: string, threadService: IThreadService) {
		this._name = name;
		this._proxy = threadService.getRemotable(RemoteTelemetryServiceHelper);
	}

	get isOptedIn(): boolean {
		throw notImplemented();
	}

	getTelemetryInfo(): TPromise<ITelemetryInfo> {
		return this._proxy.$getTelemetryInfo();
	}

	publicLog(eventName: string, data?: any): void {
		data = data || Object.create(null);
		data[this._name] = true;
		this._proxy.$publicLog(eventName, data);
	}

	timedPublicLog(): any {
		throw notImplemented();
	}

	addTelemetryAppender(): any {
		throw notImplemented();
	}
}
