import * as vscode from 'vscode';

import {
	TestAdapter,
	TestController,
	TestEvent,
	TestInfo,
	TestSuiteInfo,
} from 'vscode-test-adapter-api';

export class TestExplorerDiagnosticsController implements TestController {
	private readonly disposables = new Map<TestAdapter, { dispose(): void }[]>();
	private readonly diagnosticCollection: vscode.DiagnosticCollection;
	private readonly testEventsById = new Map<string, TestEvent>();
	private testInfosById = new Map<string, TestInfo>();

	constructor() {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('test-explorer-diagnostics');
	}

	registerTestAdapter(adapter: TestAdapter): void {
		const adapterDisposables: { dispose(): void }[] = [];
		this.disposables.set(adapter, adapterDisposables);

		adapterDisposables.push(adapter.tests(loadEvent => {
			if (loadEvent.type === 'finished' && loadEvent.suite) {
				const newTestInfosById = this.flattenTestInfos(loadEvent.suite).reduce((accumulator, info) => {
					accumulator.set(info.id, info);
					return accumulator;
				}, new Map<string, TestInfo>());

				this.testInfosById.forEach((_: TestInfo, id: string) => {
					if (!newTestInfosById.has(id)) {
						this.testEventsById.delete(id);  // test has disappeared
					}
				});

				this.testInfosById = newTestInfosById;

				this.refreshDiagnostics();
			}
		}));

		adapterDisposables.push(adapter.testStates(event => {
			if (event.type === 'test') {
				if (typeof event.test === 'string') {
					this.testEventsById.set(event.test, event);
				}
			}

			this.refreshDiagnostics();
		}));

		if (adapter.retire) {
			adapterDisposables.push(adapter.retire(retireEvent => {
				if (retireEvent.tests) {
					retireEvent.tests.forEach(id => {
						this.testInfosById.delete(id);
						this.testEventsById.delete(id);
					});
				}

				this.refreshDiagnostics();
			}));
		}
	}

	private flattenTestInfos(info: TestSuiteInfo | TestInfo): TestInfo[] {
		if (info.type === 'suite') {
			return info.children.map(child => this.flattenTestInfos(child)).reduce((accumulator, infos) => {
				return accumulator.concat(infos);
			});
		} else {
			return [info];
		}
	}

	private refreshDiagnostics() {
		this.diagnosticCollection.clear();

		this.buildDiagnosticsByPath().forEach((diagnostics, path) => {
			this.diagnosticCollection.set(vscode.Uri.file(path), diagnostics);
		});
	}

	private buildDiagnosticsByPath() {
		return Array.from(this.testEventsById.entries()).reduce((accumulator, [id, event]) => {
			if (!vscode.workspace.getConfiguration('testExplorerDiagnostics.show').get(event.state)) {
				return accumulator;
			}

			if (this.testInfosById.has(id)) {
				const info = this.testInfosById.get(id)!;

				if (info.file) {  // TODO: What if TestInfo.file isn't just a string?
					const newDiagnostic = new vscode.Diagnostic(
						this.getDiagnosticRange(event, info),
						this.getDiagnosticMessage(event, info),
						this.getDiagnosticSeverity(event),
					);
					newDiagnostic.source = 'Test Explorer';

					accumulator.set(info.file, (accumulator.get(info.file) || []).concat(newDiagnostic));
				}
			}
			return accumulator;
		}, new Map<string, vscode.Diagnostic[]>());
	}

	// TODO: What if there are multiple test event decorations?
	// TODO: How to get the true position of a test (event)?
	private getDiagnosticRange(event: TestEvent, info: TestInfo): vscode.Range {
		if (event.decorations) {
			return new vscode.Range(
				new vscode.Position(event.decorations[0].line || 0, 0),
				new vscode.Position(event.decorations[0].line || 0, 999),
			);
		} else {
			return new vscode.Range(
				new vscode.Position(info.line || 0, 0),
				new vscode.Position(info.line || 0, 999),
			);
		}
	}

	// TODO: What if there are multiple test event decorations?
	// TODO: Allow user-customizable diagnostic message
	private getDiagnosticMessage(event: TestEvent, info: TestInfo): string {
		const message = `${this.capitalizeFirstLetter(event.state)}: "${info.label}"`;

		if (event.decorations) {
			return message.concat(` (${event.decorations[0].message.trim().replace(/[\s]+/g, ' ')})`);
		} else {
			return message;
		}
	}

	private capitalizeFirstLetter([first, ...rest]: string, locale = vscode.env.language) {
		return [first.toLocaleUpperCase(locale), ...rest].join('');
	}

	private getDiagnosticSeverity(event: TestEvent): vscode.DiagnosticSeverity {
		switch (event.state) {
			case 'skipped':
				return vscode.DiagnosticSeverity.Warning;
			case 'passed':
				return vscode.DiagnosticSeverity.Information;
			default:
				return vscode.DiagnosticSeverity.Error;
		}
	}

	unregisterTestAdapter(adapter: TestAdapter): void {
		this.diagnosticCollection.clear();
		this.diagnosticCollection.dispose();

		const adapterDisposables = this.disposables.get(adapter);
		if (adapterDisposables) {
			for (const disposable of adapterDisposables) {
				disposable.dispose();
			}

			this.disposables.delete(adapter);
		}
	}
}