import { extensions, ExtensionContext } from 'vscode';
import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { TestExplorerDiagnosticsController } from './controller';

let testHub: TestHub | undefined;
let controller: TestExplorerDiagnosticsController | undefined;

export async function activate(context: ExtensionContext) {
	const testExplorerExtension = extensions.getExtension<TestHub>(testExplorerExtensionId);

	if (testExplorerExtension) {
		testHub = testExplorerExtension.exports;
		controller = new TestExplorerDiagnosticsController();
		testHub.registerTestController(controller);
	}
}

export function deactivate(): void {
	if (testHub && controller) {
		testHub.unregisterTestController(controller);
	}
}