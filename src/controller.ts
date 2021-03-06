import {
	Diagnostic,
	DiagnosticCollection,
	DiagnosticSeverity,
	Position,
	Range,
	Uri,
	env,
	languages,
	workspace,
} from 'vscode';

import {
	TestAdapter,
	TestController,
	TestEvent,
	TestInfo,
	TestSuiteInfo,
} from 'vscode-test-adapter-api';

export class TestExplorerDiagnosticsController implements TestController {
	private readonly disposables = new Map<TestAdapter, { dispose(): void }[]>();
	private readonly diagnosticCollection: DiagnosticCollection;
	private readonly testEventsById = new Map<string, TestEvent>();
	private readonly testInfosById = new Map<string, TestInfo>();

	constructor() {
		this.diagnosticCollection =
			languages.createDiagnosticCollection('testExplorerDiagnostics');
	}

	registerTestAdapter(adapter: TestAdapter): void {
		const adapterDisposables: { dispose(): void }[] = [];
		this.disposables.set(adapter, adapterDisposables);

		adapterDisposables.push(adapter.tests(testLoadEvent => {
			if (testLoadEvent.type === 'finished' && testLoadEvent.suite) {
				this.testInfosById.clear();
				this.flattenTestInfos(testLoadEvent.suite).forEach((info) => {
					this.testInfosById.set(info.id, info);
				});

				this.testInfosById.forEach((_: TestInfo, id: string) => {
					if (!this.testInfosById.has(id)) {
						this.testEventsById.delete(id);  // test has disappeared
					}
				});

				this.refreshDiagnostics();
			}
		}));

		adapterDisposables.push(adapter.testStates(testEvent => {
			if (testEvent.type === 'test') {
				if (typeof testEvent.test === 'string') {
					this.testEventsById.set(testEvent.test, testEvent);
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
				}  // TODO: #7 Should I retire everything here?

				this.refreshDiagnostics();
			}));
		}
	}

	private flattenTestInfos(info: TestSuiteInfo | TestInfo): TestInfo[] {
		if (info.type === 'suite') {
			return info.children
				.map(child => this.flattenTestInfos(child))
				.reduce((currentInfos, newInfos) => currentInfos.concat(newInfos));
		} else {
			return [info];
		}
	}

	private refreshDiagnostics() {
		this.diagnosticCollection.clear();

		this.buildDiagnosticsByPath().forEach((diagnostics, path) => {
			this.diagnosticCollection.set(Uri.file(path), diagnostics);
		});
	}

	private buildDiagnosticsByPath() {
		return Array.from(this.testEventsById.entries()).reduce((diagnosticsByPath, [id, event]) => {
			if (!workspace.getConfiguration('testExplorerDiagnostics.show').get(event.state)) {
				return diagnosticsByPath;
			}

			if (this.testInfosById.has(id)) {
				const info = this.testInfosById.get(id)!;

				if (info.file) {  // TODO: #6 What if TestInfo.file isn't just a string?
					const newDiagnostic = new Diagnostic(
						this.getDiagnosticRange(event, info),
						this.getDiagnosticMessage(event, info),
						this.getDiagnosticSeverity(event),
					);
					newDiagnostic.source = 'Test Explorer';

					diagnosticsByPath.set(info.file, (diagnosticsByPath.get(info.file) || []).concat(newDiagnostic));
				}
			}
			return diagnosticsByPath;
		}, new Map<string, Diagnostic[]>());
	}

	// TODO: #3 What if there are multiple test event decorations?
	// TODO: #4 How to get the true position of a test (event)?
	private getDiagnosticRange(event: TestEvent, info: TestInfo): Range {
		return new Range(
			new Position(event.decorations?.[0].line || info.line || 0, 0),
			new Position(event.decorations?.[0].line || info.line || 0, 999),
		);
	}

	// TODO: #3 What if there are multiple test event decorations?
	// TODO: #5 Allow user-customizable diagnostic message
	private getDiagnosticMessage(event: TestEvent, info: TestInfo): string {
		const message = `${this.capitalizeFirstLetter(event.state)}: "${info.label}"`;

		if (event.decorations) {
			return message.concat(` (${event.decorations[0].message.trim().replace(/[\s]+/g, ' ')})`);
		} else {
			return message;
		}
	}

	private capitalizeFirstLetter([first, ...rest]: string, locale = env.language) {
		return [first.toLocaleUpperCase(locale), ...rest].join('');
	}

	private getDiagnosticSeverity(event: TestEvent): DiagnosticSeverity {
		switch (event.state) {
			case 'skipped':
				return DiagnosticSeverity.Warning;
			case 'passed':
				return DiagnosticSeverity.Information;
			default:
				return DiagnosticSeverity.Error;
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