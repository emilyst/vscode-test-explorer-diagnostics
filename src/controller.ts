import * as vscode from 'vscode';
import { TestController, TestAdapter, TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';

/**
 * This class is intended as a starting point for implementing a "real" TestController.
 * The file `README.md` contains further instructions.
 */
export class ExampleController implements TestController {

	// here we collect subscriptions and other disposables that need
	// to be disposed when an adapter is unregistered
	private readonly disposables = new Map<TestAdapter, { dispose(): void }[]>();

	private statusBarItem: vscode.StatusBarItem;
	private passedTests = 0;
	private failedTests = 0;

	constructor() {

		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		this.statusBarItem.show();

		// run all tests when the statusBarItem is clicked,
		// we do this by invoking a command that is contributed by the Test Explorer extension
		this.statusBarItem.command = 'test-explorer.run-all';
	}

	registerTestAdapter(adapter: TestAdapter): void {
		
		const adapterDisposables: { dispose(): void }[] = [];
		this.disposables.set(adapter, adapterDisposables);


		// the ExampleController will simply listen for events from the Test Adapter(s)
		// and write them to a StatusBarItem

		adapterDisposables.push(adapter.tests(testLoadEvent => {

			if (testLoadEvent.type === 'started') {

				this.statusBarItem.text = 'Loading tests...';

			} else { // testLoadEvent.type === 'finished'

				const rootSuite = testLoadEvent.suite;
				const testCount = rootSuite ? countTests(rootSuite) : 0;
				this.statusBarItem.text = `Loaded ${testCount} tests`;

			}
		}));

		adapterDisposables.push(adapter.testStates(testRunEvent => {

			if (testRunEvent.type === 'started') {

				this.statusBarItem.text = 'Running tests: ...';
				this.passedTests = 0;
				this.failedTests = 0;

			} else if (testRunEvent.type === 'test') {

				if (testRunEvent.state === 'passed') {
					this.passedTests++;
				} else if (testRunEvent.state === 'failed') {
					this.failedTests++;
				}

				this.statusBarItem.text = `Running tests: ${this.passedTests} passed / ${this.failedTests} failed`;

			} else if (testRunEvent.type === 'finished') {

				this.statusBarItem.text = `Tests: ${this.passedTests} passed / ${this.failedTests} failed`;

			}
		}));
	}

	unregisterTestAdapter(adapter: TestAdapter): void {

		const adapterDisposables = this.disposables.get(adapter);
		if (adapterDisposables) {

			for (const disposable of adapterDisposables) {
				disposable.dispose();
			}

			this.disposables.delete(adapter);
		}
	}
}

function countTests(info: TestSuiteInfo | TestInfo): number {
	if (info.type === 'suite') {
		let total = 0;
		for (const child of info.children) {
			total += countTests(child);
		}
		return total;
	} else { // info.type === 'test'
		return 1;
	}
}
