# Code Prism

## 🔗 What is it?

**Code Prism extension** is a tool that can record and store various information generated during code analysis.

When we analyze the code, many meta-data could occur, such as summary of what we analyzed, what to do, additional requests, related documents and so on. These metadata could be written and stored in a separate file, but keeping these meta-data as a separate file is very cumbersome and, above all, very inefficient because meta-data and code are not interconnected.

This extension is for these cases, _this extension manage these meta-data associated with code without modifying the code._

In fact, the Code Prism is not just for source code, it is for all documents. so it allows you to leave the necessary comments on all kinds of documents(.md, .json, etc.) as well as the source code

The Code Prism is basically a code review program. but it's simple to use and includes useful features for code analysis.

**_Enjoy!_**

![demo](https://github.com/negahama/NegahamaOrg.CodePrism/blob/main/images/code-prism-demo.gif?raw=true)

## Getting Started

In order to get started, install the [CodePrism extension](https://marketplace.visualstudio.com/items?itemName=NegahamaOrg.codeprism), and then following one of the following guides:

- [Concept](#concept)
- [Features](#features)

## Concept

Many developers spend as much time understanding and analyzing systems developed by others as developing their own programs.

Sometimes you simply refer to a well-defined API, but sometimes you need to know enough about that system to participate in the development process. In this case, understanding and analyzing large and complex systems is a challenging task.

It's not just the individual's ability and effort that you need when you want to understand what purpose this function was used, why they use it like this, and how it might affect other parts of the system.

The Code Prism aims to help you understand and analyze systems

There are a number of tools available to assist with analysis. These tools analyze the code on their own and display their information in documents and diagrams.

Of course, we have to use these tools. But I think it's important to help you find the Aha-moment among the many pieces of information that a lot of tools give out.

In the process of understanding and analysis, I noted that there are more information to be searched, referenced, and recorded than I thought.

So I'm trying to make a tool that the whole system can come in at a glance by showing useful information as much as and effectively .

As a starting point, I'm going to start with something that can be easily viewed and recorded with various information generated in the analysis process, related documents, sites, my own comments, and so on.

## Features

Code Prism is consist of 4 parts

- Recording metadata
- Auto-search information of symbol
- Link documents(markdown file) to source
- Support mermaid diagram preview

Code Prism is an analytical tool, but it can also be used during development.

Code Prism is also useful enough as a substitute for todo list, bookmark, so in my case, after I developed the Code Prism, I deleted all extension related todo list, bookmark.

### Recoding metadata

The Code Prism manage information associated with a specific part of the document without changing the source.

The Code Prism manages this metadata as follows.

- Prism file
- Issue
- Note

#### Prism file

The prism file and the document correspond one-to-one, and one prism file may contain multiple `Issue`s.

#### Issue

The issue is a key structure in the Code Prism.

`Issue` is opinions on specific parts of the document. Therefore, `Issue` is linked to specific parts of the document and can have multiple `Note`s.

#### Note

`Note` is opinion and information, it can be simple text, link, image, video and document.

![screen shot](https://github.com/negahama/NegahamaOrg.CodePrism/blob/main/images/Screenshot181558.png?raw=true)

### Auto-search

It takes a lot of searching to analyze something.

With the help of a language server, VS Code can already be used for smart searches such as reference search and definition search.

I don't think there's a particular need for a new search function, but I do think there's a need to use it more conveniently or display it effectively.

When you select a symbol from the code, the Code Prism displays basic information about selected symbol in the definition view, such as the declaration and definition of this symbol by default.

And I gathered various search methods in one place(top of the definition view).

I also reduced the inconvenience of having to check the search results one by one using a search editor.

These efforts of Code Prism are just about utilizing the existing VS Code functionality, but I found it convenient just to place various search functions in one place.

- Automatically displays definition information for the symbol at the current cursor position.
- Language independent. Works in any language that supports hovers.
- Supports syntax highlighting and markdown rendering in the docs view.

![screen shot](https://github.com/negahama/NegahamaOrg.CodePrism/blob/main/images/Screenshot211953.png?raw=true)

![screen shot](https://github.com/negahama/NegahamaOrg.CodePrism/blob/main/images/reference-search-editor-demo.gif?raw=true)

### Link documents

![screen shot](https://github.com/negahama/NegahamaOrg.CodePrism/blob/main/images/Screenshot182825.png?raw=true)

#### Adaptive Link

This feature creates links to specific parts of the code.

Links that allow you to refer to a particular part of the code are useful sometimes

If you want, You can select some part of your code and generate the link by context menu or keyboard shortcut(default `Ctrl+Alt+C, Ctrl+Alt+C`) and then you can attach the generated link to any document(include codes) by using `Ctrl+V`.

Most of links to code is based on the location of the code.

But link based on location is easily invalidated during the development phase where the location of code is constantly changing.

So I made 1 + 1 link that is stored a specific part of the code, but rather than that, it was changed because it seems better to detect the change in the location of that part.

Adaptive link can respond to changes in code locations. But it's not perfect. Most of all, content changes can't be helped

![screen shot](https://github.com/negahama/NegahamaOrg.CodePrism/blob/main/images/adaptive-link-demo.gif?raw=true)

### Support mermaid diagram preview

I'm sure most of you know about mermaid.js.

The Code Prism supports only the preview of meraid.js, but it can detect the mermaid mark on the code. So when you see this mark, you'll see also `Open diagram` at the above of the mark, and you can click it to open the previewer easily.

I use `Github Copilot` to create a mermaid diagram. It doesn't always show perfect results, but it's still useful sometimes.

mermaid offical site : https://mermaid.js.org/

## 🔗 Release Notes

### 1.4.4 - November 13, 2024

I combined the code-anchor link and the 1+1 link to make it the [adaptive link](#adaptive-link)

### 1.4.3 - November 12, 2024

fixed the bug about movement of issue's position

### 1.4.2 - November 12, 2024

- fixed the bug about movement of issue's position
- modify to show only specific range(also known as fragment) when hover tooltip is shown

### 1.4.1 - November 11, 2024

fixed the bug that don't delete comments immediately when new comment was created in new document

### 1.4.0 - November 10, 2024

1. implement 1 + 1 link
2. implement the feature that generate mermaid diagram for all references
3. implement the features that are 'CodePrism.command.findReferences' and 'CodePrism.command.findImplementations'
4. I decided to include the results of the process of analyzing and developing the Code Prism using this Code Prism extension in the GitHub repository. so you can see more information about the Code Prism when you visit the [github repository](https://github.com/negahama/NegahamaOrg.CodePrism.git)

## 💚 Code Prism is base of 💚

- [Comment Linker](https://marketplace.visualstudio.com/items?itemName=antunesdq.comment-linker)
- [Docs View](https://marketplace.visualstudio.com/items?itemName=bierner.docs-view)
- [Definition View](https://marketplace.visualstudio.com/items?itemName=stevepryde.definition-view)
- [Code Explorer](https://marketplace.visualstudio.com/items?itemName=tianjianchn.code-explorer)
- [Project Notes](https://marketplace.visualstudio.com/items?itemName=willasm.pnotes)
- [CodeTour](https://marketplace.visualstudio.com/items?itemName=vsls-contrib.codetour)

Thank all of you very much!!!

## 🔗 Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## 🔗 For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)
