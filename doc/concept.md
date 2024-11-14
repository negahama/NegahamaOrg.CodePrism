# Concept

이 문서는 Code Prism의 여러가지 concept들에 대한 설명 문서이다.

## Prism, Issue, Note

- Prism은 대상 파일(모든 문서파일이 대상이 될 수 있다) 하나당 하나의 파일로 존재하며, 여러 개의 Issue를 가질 수 있다.
- Issue는 대상 파일 내의 특정 위치와 연결되어지며 해당 위치에 대한 다수의 정보(Note)를 담고 있다.
- Note은 단일 정보를 의미하며 텍스트와 Link등으로 하나의 정보를 표현한다.

<br>

Prism, Issue, Note는 `Prism.ts`파일에 정의되어져 있으며 Json 형식으로 `.prism.json` 확장자를 가지는 파일로 저장된다.

🚨 Prism 개체는 `new Prism()`으로 생성하면 안된다. 🚨  
`PrismManager.createPrism(prismName)`을 사용해야 한다. 이때 인수 prismName은 일반적으로 prism 개체의 대상이 되는 문서 파일의 이름이다. 이 이름은 프리즘 개체를 구분하는 ID가 되기 때문에 고유해야 한다.

### publish-subscribe pattern

Prism 개체는 자신이 변경되면 이를 publish하는 publish-subscribe pattern을 사용한다.

publisher는 Prism 개체이고 발생하는 event에 따라서 subscriber는 여러 개체가 될 수 있다. 아울러 event에 따라서 callback으로 전달되어지는 데이터의 타입도 다르다.

- 'create-prism' : Prism
- 'delete-prism' : Prism
- 'append-issue' : Issue
- 'update-issue' :

  Issue에 대한 update는 source property에 대한 update를 의미한다.  
  note의 변경은 note event로 따로 처리하고 그외의 다른 property는 변경되지 않는다.  
  source property의 변경은 comment controller의 mark 위치에만 영향을 미칠 뿐 따로 표시되거나 하지 않는데
  comment controller는 자동적으로 처리되므로 결국 issue update는 다른 개체에게 알릴 필요가 없다.  
  저장만 하면 된다.

- 'remove-issue' : Issue
- 'append-note' : Note
- 'update-note' : Note
- 'remove-note' : Note

## Markdown preview를 표시하는 방법

표시하는데 사용되는 여러가지 명령들이 있다.

- markdown.showPreview
- markdown.showPreviewToSide
- markdown.showPreviewToSideBySide
- markdown.showSource
- markdown.showLockedPreview
- markdown.showLockedPreviewToSide
- markdown.showLockedPreviewToSideBySide

이 중에서 markdown.showPreviewToSide를 대표로 사용한다.

그냥 오픈하는 것은 쉽다. 아래와 같이 사용하면 된다.

```ts
vscode.commands.executeCommand('markdown.showPreviewToSide', vscode.Uri.file(path))
```

🚨 vscode.Uri.file()을 사용한다는 것이 중요하다.

링크를 통해서 오픈하려면? 이것은 hover로 표시되는 마크다운 뷰에서 클릭하는 경우 같은 것이다.
대부분의 명령들은 이런 방식으로 실행할 경우 다음과 같은 형식으로 실행해야 한다.

```ts
const args = [vscode.Uri.file(path)]
const encodedArgs = encodeURIComponent(JSON.stringify(args))
const openCommandUri = vscode.Uri.parse(`command:markdown.showPreviewToSide?${encodedArgs}`)
const markdownString = new vscode.MarkdownString(
  `[🔗 Open document (⌘ + 8)](${openCommandUri}) <div>${getDocContent()}</div>`
)
markdownString.supportHtml = true
markdownString.isTrusted = true

// Return a Hover
return new vscode.Hover(markdownString)
```

또 다른 예를 들면...

```ts
const opts: vscode.TextDocumentShowOptions = {
  selection: range,
  viewColumn: vscode.ViewColumn.Beside,
}

const args = [uri, opts]

const stageCommandUri = vscode.Uri.parse(`command:window.showTextDocument?${encodeURIComponent(JSON.stringify(args))}`)
let link = new vscode.MarkdownString(`[Open...](${stageCommandUri})`)
link.isTrusted = true

let hover: vscode.Hover = {
  contents: [link],
}
return hover
```

즉 `command:<commandId>?${encodeURIComponent(JSON.stringify(args))}` 이런 형식으로 명령을 실행한다.

```ts
context.subscriptions.push(
  vscode.commands.registerCommand(
    'estudio.internal.open',
    (uri: vscode.Uri, options: vscode.TextDocumentShowOptions) => {
      logger.info('Opening a document')
      vscode.window.showTextDocument(uri, options)
    }
  )
)
```

여기서 args가 배열이라는 것을 주의한다. 오브젝트로 묶으면 command의 인수를 오브젝트로 바꿔야 한다.

아울러 프리뷰의 인수로 uri를 넘겨줄때 fragment를 추가해서 넘겨줄 수 없다.

## [Link 관련](./linker.md)

## [Comment Controller 사용법](./comment-controller.md)

## [CreateFileSystemWatcher 사용법](./filesystem-watcher.md)

## context.workspaceState 사용법

context.workspaceState 라는 것이 있다.
이것은 vscode.Memento 객체로 Key로 string을 사용하는 key-value table 객체로 keys(), get(), update() 가 전부이다.
value 값으로 어떤 값이라도 사용할 수 있다.

## setContext command 사용법

아래와 같이 다양한 정보를 저장할 수 있다.

```ts
public static readonly pinnedContext = 'CodePrism.context.definitionView.isPinned'
vscode.commands.executeCommand('setContext', DefinitionViewProvider.pinnedContext, value)
{
"command": "CodePrism.command.definitionView.pin",
"when": "!CodePrism.context.definitionView.isPinned"
},

const markerLines = new Set<number>()
vscode.commands.executeCommand('setContext', 'codeExplorer.markerLines', Array.from(markerLines))
{
  "command": "codeExplorer.gutter.revealMarker",
  "when": "editorLineNumber in codeExplorer.markerLines"
},
```

## arguments

내 경우는 command 등록을 다음과 같이 한다.

```ts
context.subscriptions.push(
  vscode.commands.registerCommand('CodePrism.command.prismFile.show', (item: PrismItem) => {
    PrismViewer.showPrismViewer(item.prism)
  })
)
```

하지만 이 방법만 있는 것은 아니다.

```ts
vscode.commands.registerCommand('CodePrism.command.prismFile.show', showPrismViewer)
//context.subscriptions.push(showPrismViewer)

function showPrismViewer() {
  const item = arguments[0]
  console.log('item:', item)
  PrismViewer.showPrismViewer(item.prism)
}
```

여기서 command handler 함수인 showPrismViewer()에서 뜬금없이 arguments 를 사용할 수 있다는 점이 중요하다.

## WorkspaceEdit 사용법

```ts
// newProjectNote - Create New Project Note and Open for Editing
const workspaceEdit = new vscode.WorkspaceEdit()
workspaceEdit.createFile(vscode.Uri.file(newProjectNote), { overwrite: false })
await vscode.workspace.applyEdit(workspaceEdit)
const document = await vscode.workspace.openTextDocument(newProjectNote)
vscode.window.showTextDocument(document, { preview: false })

// renameProjectNote - Perform Rename
const workspaceEdit = new vscode.WorkspaceEdit()
workspaceEdit.renameFile(vscode.Uri.file(arguments[0].fsPath), vscode.Uri.file(newProjectNote), { overwrite: false })
await vscode.workspace.applyEdit(workspaceEdit)
```
