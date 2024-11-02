// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// import { language_model_test } from './language-model-test.js'
import { prism_activate } from './code-prism/PrismCommands.js'
import { definition_activate } from './def-viewer/DefinitionViewProvider.js'
import { mermaid_activate } from './mermaid-viewer/mermaid-viewer.js'
// import { createTsAstViewer } from './ast-viewer/TsAstViewerMain.js'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Show a message that the extension is active
  vscode.window.showInformationMessage('Code Prism is active!')

  // language_model_test()

  prism_activate(context)
  console.log('activated prism')

  definition_activate(context)
  console.log('activated definition')

  mermaid_activate(context)
  console.log('activated mermaid')

  // createTsAstViewer(context)
  // console.log('createTsAstViewer')
  // {
  //   "id": "CodePrism.view.astViewer",
  //   "name": "Ast Viewer",
  //   "icon": "assets/logo.png",
  //   "when": "no-tslib == false"
  // },
  // {
  //   "id": "CodePrism.view.astWelcome",
  //   "name": "Ast Viewer",
  //   "icon": "assets/logo.png",
  //   "when": "no-fileCopied == true"
  // }
}

// This method is called when your extension is deactivated
export function deactivate() {}
