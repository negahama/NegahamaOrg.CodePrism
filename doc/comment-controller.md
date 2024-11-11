## Comment Controller

> 아래 내용은 github copilot에게 Comment Controller에 대해 물어본 결과를 상당부분 포함하고 있다.
> 그리고 내가 아는 한도내에서 잘못된 내용을 일부 수정하였다.

Visual Studio Code의 Comment Controller는 코드 주석을 관리하고 상호작용하는 기능을 제공하는 API입니다. 주석 컨트롤러를 사용하면 사용자가 코드의 특정 부분에 주석을 추가하고, 주석 스레드를 관리하며, 주석과 관련된 다양한 작업을 수행할 수 있습니다.

> 주석이라고 해서 소스 코드의 주석으로 생각하면 안된다.  
> 여기서의 주석은 소스 코드의 특정 부분과 연결되어지기는 하지만 소스 코드에 남기는 주석이 아니라 사용자가 추가하는 코드에 대한 코멘트이다.

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
        author: {
          name: 'User',
          iconPath: vscode.Uri.parse('https://www.gravatar.com/avatar/your-gravatar-hash'),
        },
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

## Code Prism에서의 Comment Controller의 사용

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
