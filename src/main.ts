import * as vscode from 'vscode';
import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { ExampleController } from './controller';

let testHub: TestHub | undefined;
let controller: ExampleController | undefined;

export async function activate(context: vscode.ExtensionContext) {

	// get the Test Explorer extension
	const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);

	if (testExplorerExtension) {

		testHub = testExplorerExtension.exports;
		controller = new ExampleController();
		testHub.registerTestController(controller);

	}
}

export function deactivate(): void {
	if (testHub && controller) {
		testHub.unregisterTestController(controller);
	}
}