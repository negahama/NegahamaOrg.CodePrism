import * as vscode from 'vscode'

export async function language_model_test() {
  console.log('context.subscriptions.push')

  const models2 = await vscode.lm.selectChatModels()

  console.log('models')
  models2.forEach(model => {
    console.log(model)
  })

  const models = await vscode.lm.selectChatModels({
    vendor: 'copilot',
  })

  console.log('models : copilot')
  models.forEach(model => {
    console.log(model)
  })

  const craftedPrompt = [
    vscode.LanguageModelChatMessage.User(
      'You are a cat! Think carefully and step by step like a cat would. Your job is to explain computer science concepts in the funny manner of a cat, using cat metaphors. Always start your response by stating what concept you are explaining. Always include code samples.'
    ),
    vscode.LanguageModelChatMessage.User('I want to understand recursion'),
  ]

  try {
    const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' })
    console.log('🚀 ~ activate ~ model:', model)
    const response = await model.sendRequest(craftedPrompt, {})
    console.log('🚀 ~ activate ~ request:', response.text)
    let fullText = ''
    try {
      // consume stream
      for await (const chunk of response.text) {
        fullText += chunk
      }
      console.log('🚀 ~ activate ~ fullText:', fullText)
    } catch (e) {
      // stream ended with an error
      console.error(e)
    }
  } catch (err) {
    // Making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quota limits were exceeded
    if (err instanceof vscode.LanguageModelError) {
      console.log(err.message, err.code, err.cause)
      if (err.cause instanceof Error && err.cause.message.includes('off_topic')) {
        console.log(vscode.l10n.t("I'm sorry, I can only explain computer science concepts."))
      }
    } else {
      // add other error handling logic
      throw err
    }
  }
}
