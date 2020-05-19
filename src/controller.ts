import {
	Diagnostic,
	DiagnosticCollection,
	DiagnosticSeverity,
	Position,
	Range,
	Uri,
	languages,
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
	private testInfosById = new Map<string, TestInfo>();

	constructor() {
		this.diagnosticCollection = languages.createDiagnosticCollection('test-explorer-diagnostics');
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

				this.resetDiagnosticsCollection();
			}
		}));

		adapterDisposables.push(adapter.testStates(event => {
			if (event.type === 'test') {
				if (typeof event.test === 'string') {
					this.testEventsById.set(event.test, event);
				}
			}

			this.resetDiagnosticsCollection();
		}));

		if (adapter.retire) {
			adapterDisposables.push(adapter.retire(retireEvent => {
				if (retireEvent.tests) {
					retireEvent.tests.forEach(id => {
						this.testInfosById.delete(id);
						this.testEventsById.delete(id);
					});
				}

				this.resetDiagnosticsCollection();
			}));
		}
	}

	private resetDiagnosticsCollection() {
		this.diagnosticCollection.clear();

		this.buildDiagnosticsByPath().forEach((diagnostics, path) => {
			this.diagnosticCollection.set(Uri.file(path), diagnostics);
		});
	}

	private buildDiagnosticsByPath() {
		return Array.from(this.testEventsById.entries()).reduce((accumulator, [id, event]) => {
			if (event.state !== 'failed') {
				return accumulator;
			}

			if (this.testInfosById.has(id)) {
				const info = this.testInfosById.get(id)!;

				if (info.file && event.decorations) {
					const diagnostics: Diagnostic[] = event.decorations.map(decoration => {
						const newDiagnostic = new Diagnostic(
							new Range(
								new Position(decoration.line, 0),
								new Position(decoration.line, 999)  // just do the whole line for now
							),
							decoration.message.trim().replace(/[\s]+/g, ' '),
							DiagnosticSeverity.Error
						);
						newDiagnostic.source = 'Test Explorer';

						return newDiagnostic;
					});

					accumulator.set(
						info.file,
						(accumulator.get(info.file) || []).concat(diagnostics || [])
					);
				}
			}
			return accumulator;
		}, new Map<string, Diagnostic[]>());
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