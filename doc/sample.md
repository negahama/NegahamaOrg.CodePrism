## 유용한 코드들

```ts
/**
 * Renames a Prism file from the old name to the new name within the Visual Studio Code workspace..
 * rename은 this.prisms에 영향을 주지 않는다.
 *
 * @param oldname - The current name of the file to be renamed.
 * @param newname - The new name for the file.
 * @returns A promise that resolves when the file has been renamed.
 */
static async renamePrismFile(oldname: string, newname: string): Promise<boolean> {
  const newFilePath = this.getPrismFilePath(newname)
  const workspaceEdit = new vscode.WorkspaceEdit()
  workspaceEdit.renameFile(vscode.Uri.file(oldname), vscode.Uri.file(newFilePath), { overwrite: false })
  await vscode.workspace.applyEdit(workspaceEdit)
  return true
}
```

```ts
/**
 * Creates a new Prism file based on the currently active text editor's file.
 *
 * This method checks if there is an active text editor and retrieves the file name of the document.
 * If no active text editor is found, a warning message is displayed to the user.
 *
 * It then parses the file name and checks if a Prism file with the same name already exists.
 * If a Prism file with the same name exists, a warning message is displayed to the user.
 *
 * If the file name is valid and no existing Prism file is found, it proceeds to create a new Prism file.
 */
createPrismFile() {
  // prism folder의 존재 여부와 상관없이 생성할 수 있다.
  const editFileName = vscode.window.activeTextEditor?.document.fileName
  if (!editFileName) {
    vscode.window.showWarningMessage('You need to select(activate) the source code which you want to')
    return
  }

  const prismFileName = path.parse(editFileName).name
  vscode.window.showInformationMessage(`Create Prism File: ${prismFileName}`)
  if (prismFileName === undefined || PrismFileManager.isPrismFileExists(prismFileName)) {
    vscode.window.showWarningMessage('Multiple prism files are too much for Homo sapiens.')
    return
  }

  return PrismManager.createPrismAndFile(prismFileName)
}
```

## 참고 자료

https://github.com/pg-vscode-extn-kr/pg-vscode-extn-kr.github.io
https://github.com/microsoft/vscode/wiki/Issues-Triaging#our-triaging-flow

https://code.visualstudio.com/api/extension-guides/chat

https://code.visualstudio.com/api/extension-guides/tree-view#contributing-views-to-view-containers
https://github.com/microsoft/vscode-extension-samples/blob/main/tree-view-sample/src/nodeDependencies.ts
https://marketplace.visualstudio.com/items?itemName=nur-publisher.hypercomments-vscode

https://medium.com/@lnakhul/mastering-vs-code-extension-api-commands-a-hands-on-guide-de679bd07cc9

https://learn.microsoft.com/en-us/semantic-kernel/overview/

https://blog.naver.com/keiaz/220915832892
https://code.visualstudio.com/api/references/commands
https://code.visualstudio.com/docs/languages/markdown
https://stackoverflow.com/questions/68318892/open-another-document-in-vscode-extension-from-hover/68319454#68319454

유용할 것 같은 이모티콘
📁 Folders
🗄 Files
⛓ One-to-Many
(⌘ + 8)
