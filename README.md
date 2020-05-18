# Implementing a Test Controller for Visual Studio Code

This repository contains an example for implementing a `TestController` extension that works with the
[Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) extension.

## Setup

* install the [Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) extension
* fork and clone this repository and open it in VS Code
* run `npm install`
* run `npm run watch` or start the watch Task in VS Code
* start the debugger

You should now see a second VS Code window, the Extension Development Host, in which the `ExampleController` is active:
When you open a folder in this window, a Status Bar Item with the text "Loaded *n* tests" should show up.
When you click that Status Bar Item, a test run will be started and the text of the Status Bar Item will change
to show the number of passed and failed tests.

## Implementation

This really depends on what you want to do with your Test Controller.
The example code shows how to subscribe to the main `TestAdapter` events and you can also send `load`/`run`/`debug`
requests to them.
You will receive all events sent by the Test Adapters, even if the requests that led to these events came from 
the Test Explorer or any other Test Controller.

## Publish

* update `package.json` with your preferred values (at a minimum you should change `name`, `displayName`, `description`, `author`, `publisher`, `homepage`, `repository` and `bugs`)
* create an icon for your Test Controller (there's an SVG version of the Test Explorer icon at `img/test-explorer.svg`) and reference it in `package.json`
* replace this README with your documentation

Now you're ready to [publish](https://code.visualstudio.com/docs/extensions/publish-extension) the first version of your Test Controller.
