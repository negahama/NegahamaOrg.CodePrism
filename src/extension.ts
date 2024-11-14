// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// import { language_model_test } from './language-model-test.js'
import { PrismPath } from './code-prism/PrismPath.js'
import { prism_activate } from './code-prism/PrismCommands.js'
import { PrismDocDetector } from './code-prism/PrismDocDetector'
import { PrismLinkDetector } from './code-prism/PrismLinkDetector'
import { PrismAdaptiveLinkDetector } from './code-prism/PrismAdaptiveLinkDetector.js'
import { PrismRefDiagramGenerator } from './code-prism/PrismRefDiagramGenerator'
import { PrismSearchEditor } from './code-prism/PrismSearchEditor'
import { definition_activate } from './def-viewer/DefinitionViewProvider'
import { mermaid_activate } from './mermaid-viewer/mermaid-viewer'
import { output } from './code-prism/PrismOutputChannel'
// import { createTsAstViewer } from './ast-viewer/TsAstViewerMain.js'

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // Show a message that the extension is active
  vscode.window.showInformationMessage('Code Prism is active!')

  // language_model_test()

  PrismPath.activate(context)
  output.log('activated prism-path')

  prism_activate(context)
  output.log('activated prism')

  PrismDocDetector.activate(context)
  output.log('activated doc-detector')

  PrismLinkDetector.activate(context)
  output.log('activated link-detector')

  PrismAdaptiveLinkDetector.activate(context)
  output.log('activated adaptive-link-detector')

  PrismSearchEditor.activate(context)
  output.log('activated prism-search-editor')

  PrismRefDiagramGenerator.activate(context)
  output.log('activated ref-diagram generator')

  definition_activate(context)
  output.log('activated definition')

  mermaid_activate(context)
  output.log('activated mermaid')

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
