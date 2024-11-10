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
- 'update-issue' : update-issue는 delete-issue와 append-issue로 구현되므로 별도로 존재하지 않는다
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

## Comment Controller

Visual Studio Code의 Comment Controller는 코드 주석을 관리하고 상호작용하는 기능을 제공하는 API입니다. 주석 컨트롤러를 사용하면 사용자가 코드의 특정 부분에 주석을 추가하고, 주석 스레드를 관리하며, 주석과 관련된 다양한 작업을 수행할 수 있습니다.

주석이라고 해서 소스 코드의 주석으로 생각하면 안된다.  
여기서의 주석은 소스 코드의 특정 부분과 연결되어지기는 하지만 소스 코드에 남기는 주석이 아니라 사용자가 추가하는 코드에 대한 코멘트이다.

### 주요 구성 요소

1. **Comment Controller**:

   - 주석을 관리하는 기본 컨트롤러입니다.
   - 주석 스레드를 생성하고 관리할 수 있습니다.

2. **Comment Thread**:

   - 주석 스레드는 코드의 특정 범위에 연결된 주석의 모음입니다.
   - 각 주석 스레드는 여러 개의 주석을 포함할 수 있습니다.

3. **Comment**:
   - 주석 스레드 내의 개별 주석입니다.
   - 주석은 작성자, 내용, 작성 시간 등의 정보를 포함할 수 있습니다.

### 주요 메서드 및 속성

- `createCommentController(id: string, label: string)`: 새로운 주석 컨트롤러를 생성합니다.
- `createCommentThread(uri: Uri, range: Range, comments: Comment[])`: 특정 범위에 주석 스레드를 생성합니다.
- `dispose()`: 주석 컨트롤러를 삭제합니다.

### 예제 코드

아래는 주석 컨트롤러를 생성하고 주석 스레드를 추가하는 예제 코드입니다.

```typescript
import * as vscode from 'vscode'

export function activate(context: vscode.ExtensionContext) {
  const commentController = vscode.comments.createCommentController(
    'exampleCommentController',
    'Example Comment Controller'
  )
  context.subscriptions.push(commentController)

  const disposable = vscode.commands.registerCommand('extension.addComment', () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      return
    }

    const uri = editor.document.uri
    const range = editor.selection
    const commentThread = commentController.createCommentThread(uri, range, [])
    commentThread.comments = [
      {
        body: new vscode.MarkdownString('This is a comment'),
        userName: 'User',
        gravatar: '',
        contextValue: '',
      },
    ]
  })

  context.subscriptions.push(disposable)
}

export function deactivate() {}
```

### 주석 컨트롤러의 활용

- **코드 리뷰**: 코드 리뷰 과정에서 특정 코드 범위에 주석을 추가하여 피드백을 제공할 수 있습니다.
- **문서화**: 코드의 특정 부분에 대한 설명이나 주석을 추가하여 문서화할 수 있습니다.
- **협업**: 팀원 간의 협업 시 주석을 통해 의견을 교환할 수 있습니다.

주석 컨트롤러를 사용하면 코드의 특정 부분에 주석을 추가하고 관리하는 작업을 보다 효율적으로 수행할 수 있습니다.

Visual Studio Code의 주석 컨트롤러를 사용하는 확장 프로그램은 여러 가지가 있습니다. 주석 컨트롤러를 사용하면 코드 리뷰, 피드백 제공, 문서화 등의 작업을 보다 효율적으로 수행할 수 있습니다. 아래는 주석 컨트롤러를 사용하는 몇 가지 대표적인 확장 프로그램입니다.

1. GitLens
   설명: GitLens는 Git 리포지토리의 히스토리와 변경 사항을 시각화하고, 코드 리뷰와 주석 기능을 제공하는 확장 프로그램입니다.
   기능: 코드의 특정 부분에 주석을 추가하고, Git 히스토리를 통해 변경 사항을 추적할 수 있습니다.
2. Live Share
   설명: Live Share는 실시간으로 코드 편집과 디버깅을 공유할 수 있는 협업 도구입니다.
   기능: 실시간으로 주석을 추가하고, 팀원들과 함께 코드 리뷰를 진행할 수 있습니다.
3. CodeStream
   설명: CodeStream은 코드 리뷰와 협업을 위한 확장 프로그램으로, 주석을 통해 팀원들과 의견을 교환할 수 있습니다.
   기능: 코드의 특정 부분에 주석을 추가하고, 주석을 통해 피드백을 제공할 수 있습니다.
4. Review Board
   설명: Review Board는 코드 리뷰를 위한 확장 프로그램으로, 주석을 통해 코드 리뷰를 진행할 수 있습니다.
   기능: 코드의 특정 부분에 주석을 추가하고, 주석을 통해 코드 리뷰를 진행할 수 있습니다.

### add issue

issue는 comment thread와 동일한 개념이다.  
issue는 소스코드의 특정 범위와 일대일 대응한다.

issue를 추가하는 것은 두 가지 방법이 있다.

- Comment controller에서 직접 comment thread를 만드는 방법
- 소스 코드 텍스트 컨텍스트 메뉴에서 issue 생성하는 방법

#### comment controller가 직접 생성하는 경우

이 경우 생성되어진 thread를 인식하고 반영하는 방법이 필요한데 이를 위해서 contribute의 "comments/commentThread/context" 항목을 사용한다.
이 항목은 주석 스레드가 특정 상황이나 위치에서 생성될 때 입력 다이얼로그가 표시되는데 여기에 추가될 버튼을 정의하는데 사용된다. 이 버튼들은 주석 스레드의 동작을 제어하거나 특정 조건에서만 활성화되도록 할 수 있다.

"comments/commentThread/context" 항목에 다음을 추가한다.

```json
"comments/commentThread/context": [
  {
    "command": "CodePrism.command.addIssue.controller",
    "group": "inline",
    "when": "commentController == code-prism-issue-tracker"
  },
  {
    "command": "CodePrism.command.addIssue.cancel",
    "group": "inline",
    "when": "commentController == code-prism-issue-tracker"
  }
],
```

위 설정은 `addIssue.controller`와 `addIssue.cancel` 두 개의 버튼이 표시되게 한다.

이때 add issue 버튼을 클릭하면 전달되는 파라메터는 vscode.CommentReply 라는 것이 중요하다.

하지만 이 경우 issue와 note를 구분하는 것이 문제가 된다.

Comment controller가 사용하는 입력 다이얼로그는 comment의 입력을 위한 것으로 기존에 comment thread가 있던 없던 동일한 다이얼로그가 사용된다. Comment controller는 이 다이얼로그를 이용해서 기존에 comment thread가 있는 경우는 해당 thread에 새로운 comment를 추가하고 기존 thread가 없는 경우(새로운 thread가 만들어진 경우)에도 comment가 입력되면 thread를 같이 생성한다. 즉 comment thread를 별도로 제어할 필요가 없다(할수없다).

따라서 내 경우처럼 기존 스레드에 해당하는 이슈를 관리해야 하는 경우에는 이를 알아서 처리해야 한다.  
이를 위해서 issue를 추가하는 명령은 없애고 그냥 note를 추가하는 명령에서 issue가 없으면 생성하는 것으로 한다. 이때 issue 말고도 comment thread 자체도 추가해야 한다.

아울러 추가하지 않고 취소하는 경우도 thread가 있는 상태에서 comment 추가만 취소하는 경우와 thread 자체가 없어 스레드가 취소되는 경우로 나눠지는데 thread가 있는 상태에서 comment 추가만 취소하는 경우는 아무 것도 안해도 되지만 thread 자체를 취소하는 경우는 명시적으로 thread를 dispose해 주어야 한다. comment controller에서는 이런 경우에 대해서 자동적으로 처리하지 않고 있다.

CommentThread는 당연히 Comment 개체들을 가지고 있는 comments 프로퍼티를 가지고 있다.

이 Comment 개체는 다음과 같이 되어져 있는데 Comment를 구현한 유저 정의 comment를 이용해서 기능을 확장한다.

````ts
export interface Comment {
  /**
   * The human-readable comment body
   */
  body: string | MarkdownString

  /**
   * {@link CommentMode Comment mode} of the comment
   */
  mode: CommentMode

  /**
   * The {@link CommentAuthorInformation author information} of the comment
   */
  author: CommentAuthorInformation

  /**
   * Context value of the comment. This can be used to contribute comment specific actions.
   * For example, a comment is given a context value as `editable`. When contributing actions to `comments/comment/title`
   * using `menus` extension point, you can specify context value for key `comment` in `when` expression like `comment == editable`.
   * ```json
   *	"contributes": {
   *		"menus": {
   *			"comments/comment/title": [
   *				{
   *					"command": "extension.deleteComment",
   *					"when": "comment == editable"
   *				}
   *			]
   *		}
   *	}
   * ```
   * This will show action `extension.deleteComment` only for comments with `contextValue` is `editable`.
   */
  contextValue?: string

  /**
   * Optional reactions of the {@link Comment}
   */
  reactions?: CommentReaction[]

  /**
   * Optional label describing the {@link Comment}
   * Label will be rendered next to authorName if exists.
   */
  label?: string

  /**
   * Optional timestamp that will be displayed in comments.
   * The date will be formatted according to the user's locale and settings.
   */
  timestamp?: Date
}
````

PrismComment 은 Comment에 id, label, savedBody, thread가 추가한 자료형으로 각 자료형은 다음과 같은 목적으로 사용된다.

body: string | MarkdownString
실제 comment 내용

mode: CommentMode
사용하지 않는다.

author: CommentAuthorInformation
이 항목은 표시되어질 때 가장 먼저 표시되어진다. Comment Controller 자체가 여러 사람들이 주석을 남기는 게시판과 같은 것을 모델로 하는 것이라서 thread라는 개념도 있는 것이고 그래서 author는 개별 comment를 표시할 때 가장 먼저 표시되는데 코드 프리즘은 comment의 종류(category)를 author에 지정해서 종류가 가장 먼저 표시되게 하는 용도로 쓰고 있다.

contextValue?: string
사용하지 않는다.

reactions?: CommentReaction[]
사용하지 않는다.

label?: string
이것은 author 다음에 표시되고 원래는 body의 타이틀로 사용되는 것으로 보인다.  
하지만 여기서는 생성시간을 저장하고 있다. timestamp가 있긴 하지만 생성시간을 그냥 문자열로 처리하고 있고 표시되어질 위치도 여기가 적당해 이렇게 사용하고 있다.

timestamp?: Date
사용하지 않는다.

id: string
comment를 구분하는 용도로 사용된다. 생성될 때 uuid로 지정된다.

savedBody: string | MarkdownString
변경하다가 취소하는 경우 원래 내용을 복원하기 위한 용도로 사용된다.

thread: CommentThread
이것은 comment를 가지고 있는 상위 thread를 가지고 있는데 매우 유용하다. comment에 대한 수정, 삭제 같은 명령들은 comment 자체만을 인수로 받는데 경우에 따라서는 스레드에 대한 처리나 스레드의 정보가 필요하지만 comment만으로 해당 comment의 스레드를 알아낼 방법이 없기 때문에 이 기능은 매우 유용하다.

#### 컨텍스트 메뉴로 수동으로 입력할 경우

컨텍스트 메뉴를 이용해서 issue를 수동으로 추가하는 것은 쉽다.

다만 이때 전달되는 파라메터는 파일의 Uri 이다.

해당 라인은 액티브 텍스트 에디터의 Selection을 이용해서 직접 구해야 하는 것으로 보인다.

참고로 "editor/lineNumber/context" 항목이 정의되어져 있긴 하지만 이것은 호출되지 않는 것 같다.

## setContext 사용법

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

## clipboard 사용법

```ts
await vscode.env.clipboard.writeText(getMarkerClipboardText(el.marker))

function getMarkerClipboardText(marker: Marker) {
  let tags = marker.tags?.map(t => '[' + t + ']').join('') ?? ''
  if (tags.length) tags += ' '

  const loc = `${getRelativeFilePath(marker.file)}:${marker.line + 1}:${marker.column + 1}`
  const title = marker.title ? ' # ' + marker.title : ''
  const indent = '  '.repeat(marker.indent ?? 0)

  return `${indent}- ${tags}${loc} ${marker.code}${title}`
}

const text = await vscode.env.clipboard.readText()

const lines = text.split('\n')
const markers = lines
  .map(line => {
    const matches = /^(.+?) \(((?:\/[^/]+)+):(\d+)\)$/.exec(line)
    if (!matches) return null
    const code = matches[1]
    const file = matches[2]
    const lineNo = parseInt(matches[3], 10)
    return { code, file, line: lineNo - 1, column: 0 }
  })
  .filter(Boolean) as Omit<Marker, 'createdAt' | 'id'>[]
```

## argument

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

## CreateFileSystemWatcher 사용법

```ts
const globalWatcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(vscode.Uri.file(globalNotesFolder), '*.{md,MD,Md,mD}')
)
globalWatcher.onDidCreate(uri => GlobalOutlineProvider.refresh()) // Listen to files/folders being created
globalWatcher.onDidDelete(uri => GlobalOutlineProvider.refresh()) // Listen to files/folders getting deleted
```

````ts
/**
 * Creates a file system watcher that is notified on file events (create, change, delete)
 * depending on the parameters provided.
 *
 * By default, all opened {@link workspace.workspaceFolders workspace folders} will be watched
 * for file changes recursively.
 *
 * Additional paths can be added for file watching by providing a {@link RelativePattern} with
 * a `base` path to watch. If the path is a folder and the `pattern` is complex (e.g. contains
 * `**` or path segments), it will be watched recursively and otherwise will be watched
 * non-recursively (i.e. only changes to the first level of the path will be reported).
 *
 * *Note* that paths that do not exist in the file system will be monitored with a delay until
 * created and then watched depending on the parameters provided. If a watched path is deleted,
 * the watcher will suspend and not report any events until the path is created again.
 *
 * If possible, keep the use of recursive watchers to a minimum because recursive file watching
 * is quite resource intense.
 *
 * Providing a `string` as `globPattern` acts as convenience method for watching file events in
 * all opened workspace folders. It cannot be used to add more folders for file watching, nor will
 * it report any file events from folders that are not part of the opened workspace folders.
 *
 * Optionally, flags to ignore certain kinds of events can be provided.
 *
 * To stop listening to events the watcher must be disposed.
 *
 * *Note* that file events from recursive file watchers may be excluded based on user configuration.
 * The setting `files.watcherExclude` helps to reduce the overhead of file events from folders
 * that are known to produce many file changes at once (such as `.git` folders). As such,
 * it is highly recommended to watch with simple patterns that do not require recursive watchers
 * where the exclude settings are ignored and you have full control over the events.
 *
 * *Note* that symbolic links are not automatically followed for file watching unless the path to
 * watch itself is a symbolic link.
 *
 * *Note* that the file paths that are reported for having changed may have a different path casing
 * compared to the actual casing on disk on case-insensitive platforms (typically macOS and Windows
 * but not Linux). We allow a user to open a workspace folder with any desired path casing and try
 * to preserve that. This means:
 * * if the path is within any of the workspace folders, the path will match the casing of the
 *   workspace folder up to that portion of the path and match the casing on disk for children
 * * if the path is outside of any of the workspace folders, the casing will match the case of the
 *   path that was provided for watching
 * In the same way, symbolic links are preserved, i.e. the file event will report the path of the
 * symbolic link as it was provided for watching and not the target.
 *
 * ### Examples
 *
 * The basic anatomy of a file watcher is as follows:
 *
 * ```ts
 * const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(<folder>, <pattern>));
 *
 * watcher.onDidChange(uri => { ... }); // listen to files being changed
 * watcher.onDidCreate(uri => { ... }); // listen to files/folders being created
 * watcher.onDidDelete(uri => { ... }); // listen to files/folders getting deleted
 *
 * watcher.dispose(); // dispose after usage
 * ```
 *
 * #### Workspace file watching
 *
 * If you only care about file events in a specific workspace folder:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '**​/*.js'));
 * ```
 *
 * If you want to monitor file events across all opened workspace folders:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher('**​/*.js');
 * ```
 *
 * *Note:* the array of workspace folders can be empty if no workspace is opened (empty window).
 *
 * #### Out of workspace file watching
 *
 * To watch a folder for changes to *.js files outside the workspace (non recursively), pass in a `Uri` to such
 * a folder:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(<path to folder outside workspace>), '*.js'));
 * ```
 *
 * And use a complex glob pattern to watch recursively:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(<path to folder outside workspace>), '**​/*.js'));
 * ```
 *
 * Here is an example for watching the active editor for file changes:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.window.activeTextEditor.document.uri, '*'));
 * ```
 *
 * @param globPattern A {@link GlobPattern glob pattern} that controls which file events the watcher should report.
 * @param ignoreCreateEvents Ignore when files have been created.
 * @param ignoreChangeEvents Ignore when files have been changed.
 * @param ignoreDeleteEvents Ignore when files have been deleted.
 * @returns A new file system watcher instance. Must be disposed when no longer needed.
 */
export function createFileSystemWatcher(
  globPattern: GlobPattern,
  ignoreCreateEvents?: boolean,
  ignoreChangeEvents?: boolean,
  ignoreDeleteEvents?: boolean
): FileSystemWatcher

/**
 * A relative pattern is a helper to construct glob patterns that are matched
 * relatively to a base file path. The base path can either be an absolute file
 * path as string or uri or a {@link WorkspaceFolder workspace folder}, which is the
 * preferred way of creating the relative pattern.
 */
export class RelativePattern {
  /**
   * A base file path to which this pattern will be matched against relatively. The
   * file path must be absolute, should not have any trailing path separators and
   * not include any relative segments (`.` or `..`).
   */
  baseUri: Uri

  /**
   * A base file path to which this pattern will be matched against relatively.
   *
   * This matches the `fsPath` value of {@link RelativePattern.baseUri}.
   *
   * *Note:* updating this value will update {@link RelativePattern.baseUri} to
   * be a uri with `file` scheme.
   *
   * @deprecated This property is deprecated, please use {@link RelativePattern.baseUri} instead.
   */
  base: string

  /**
   * A file glob pattern like `*.{ts,js}` that will be matched on file paths
   * relative to the base path.
   *
   * Example: Given a base of `/home/work/folder` and a file path of `/home/work/folder/index.js`,
   * the file glob pattern will match on `index.js`.
   */
  pattern: string

  /**
   * Creates a new relative pattern object with a base file path and pattern to match. This pattern
   * will be matched on file paths relative to the base.
   *
   * Example:
   * ```ts
   * const folder = vscode.workspace.workspaceFolders?.[0];
   * if (folder) {
   *
   *   // Match any TypeScript file in the root of this workspace folder
   *   const pattern1 = new vscode.RelativePattern(folder, '*.ts');
   *
   *   // Match any TypeScript file in `someFolder` inside this workspace folder
   *   const pattern2 = new vscode.RelativePattern(folder, 'someFolder/*.ts');
   * }
   * ```
   *
   * @param base A base to which this pattern will be matched against relatively. It is recommended
   * to pass in a {@link WorkspaceFolder workspace folder} if the pattern should match inside the workspace.
   * Otherwise, a uri or string should only be used if the pattern is for a file path outside the workspace.
   * @param pattern A file glob pattern like `*.{ts,js}` that will be matched on paths relative to the base.
   */
  constructor(base: WorkspaceFolder | Uri | string, pattern: string)
}
````

```ts
// updateDecorations - Ignore comments in strings 
let commentInString = /^[^'"\r\n]+(['"])[^'"]+[\r\n]/gmi

let keyword = element.keyword
let keywordRegex = new RegExp('\\b'+keyword+'\\b:?', 'gi');

let regExStartFixed = regExStart.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
let regExEnd = element.endText;
let regExEndFixed = regExEnd.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
let tagBlockRegEx = new RegExp(regExStartFixed+'([^\r\n]+?)'+regExEndFixed,'gi');

let filelinkRegEx = /project file:\s*([\w\s\d!@()\-+]+.md)/gi;

let parenthesesRegEx = /(\(.+\))/gi;
while (commentMatch = commentsRegEx.exec(text)) {

// updateDecorations - Special Tags - Curly Braces 
let curlyRegEx = /(\{.+\})/gi;
while (commentMatch = commentsRegEx.exec(text)) {

// updateDecorations - Special Tags - Brackets 
let bracketRegEx = /(\[(.+)\])/gi;
while (commentMatch = commentsRegEx.exec(text)) {

// updateDecorations - Special Tags - Backticks 
let backtickRegEx = /(`.*?`)/gi;

// updateDecorations - Special Tags - Double Quotes 
let doubleQuotesRegEx = /(\".*?\")/gi;

// updateDecorations - Special Tags - Single Quotes 
let singleQuotesRegEx = /('.*')/gi;

```
