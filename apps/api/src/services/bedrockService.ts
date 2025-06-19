import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../utils/logger';

export interface BedrockAnalysisResult {
  steps: Array<{
    order: number;
    action: string;
    description: string;
    element: string;
    coordinates?: { x: number; y: number };
    screenshot: string;
  }>;
  summary: string;
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export class BedrockService {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
  }

  async analyzeScreenshot(imageBuffer: Buffer, context?: string): Promise<BedrockAnalysisResult> {
    try {
      const base64Image = imageBuffer.toString('base64');
      
      const prompt = `Analyze this screenshot and identify the user interface elements and the action being performed. 
      
      ${context ? `Context: ${context}` : ''}
      
      Return a JSON response with the following structure:
      {
        "action": "brief description of the action (e.g., 'click', 'type', 'navigate')",
        "element": "description of the UI element being interacted with",
        "description": "detailed step description in natural language",
        "coordinates": {"x": number, "y": number} (if clickable element detected),
        "confidence": number (0-1)
      }
      
      Focus on:
      1. Identifying clickable elements (buttons, links, form fields)
      2. Understanding the user's intent
      3. Providing clear, actionable instructions
      4. Detecting form inputs, navigation, and interactions`;

      const response = await this.client.send(new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          }],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const analysisText = responseBody.content[0].text;
      
      // Parse the JSON response from Claude
      const analysis = JSON.parse(analysisText);
      
      return {
        steps: [{
          order: 1,
          action: analysis.action,
          description: analysis.description,
          element: analysis.element,
          coordinates: analysis.coordinates,
          screenshot: base64Image,
        }],
        summary: analysis.description,
        estimatedTime: '30 seconds',
        difficulty: 'beginner',
      };
    } catch (error) {
      logger.error('Bedrock analysis error:', error);
      throw new Error('Failed to analyze screenshot with AI');
    }
  }

  async generateStepByStepGuide(screenshots: Buffer[], interactions: any[]): Promise<BedrockAnalysisResult> {
    try {
      const analysisPromises = screenshots.map((buffer, index) => 
        this.analyzeScreenshot(buffer, interactions[index]?.context)
      );
      
      const stepAnalyses = await Promise.all(analysisPromises);
      
      // Combine individual analyses into a comprehensive guide
      const allSteps = stepAnalyses.flatMap(analysis => analysis.steps)
        .map((step, index) => ({ ...step, order: index + 1 }));

      const summaryPrompt = `Given these step-by-step actions, create a comprehensive guide summary:
      
      Steps: ${JSON.stringify(allSteps.map(s => ({ action: s.action, description: s.description })))}
      
      Provide:
      1. A clear, concise summary of the entire process
      2. Estimated completion time
      3. Difficulty level (beginner/intermediate/advanced)
      4. Any tips or warnings for users`;

      const summaryResponse = await this.client.send(new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: summaryPrompt,
            }],
          }],
          max_tokens: 500,
          temperature: 0.1,
        }),
      }));

      const summaryBody = JSON.parse(new TextDecoder().decode(summaryResponse.body));
      const summary = summaryBody.content[0].text;

      return {
        steps: allSteps,
        summary,
        estimatedTime: `${allSteps.length * 30} seconds`,
        difficulty: allSteps.length > 10 ? 'advanced' : allSteps.length > 5 ? 'intermediate' : 'beginner',
      };
    } catch (error) {
      logger.error('Bedrock guide generation error:', error);
      throw new Error('Failed to generate step-by-step guide');
    }
  }

  async enhanceContent(content: string, style: string = 'professional'): Promise<string> {
    try {
      const prompt = `Enhance the following process documentation content to be more ${style} and user-friendly:

      Original content: ${content}
      
      Improve:
      1. Clarity and readability
      2. Professional tone
      3. Actionable instructions
      4. Error prevention tips
      5. User experience considerations
      
      Return only the enhanced content, maintaining the same structure.`;

      const response = await this.client.send(new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: prompt,
            }],
          }],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text;
    } catch (error) {
      logger.error('Bedrock content enhancement error:', error);
      throw new Error('Failed to enhance content with AI');
    }
  }

  async translateContent(content: string, targetLanguage: string): Promise<string> {
    try {
      const prompt = `Translate the following process documentation content to ${targetLanguage}, maintaining technical accuracy and professional tone:

      Content: ${content}
      
      Ensure:
      1. Technical terms are accurately translated
      2. UI element names are preserved or appropriately localized
      3. Step-by-step structure is maintained
      4. Professional documentation style is preserved`;

      const response = await this.client.send(new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: prompt,
            }],
          }],
          max_tokens: 2000,
          temperature: 0.1,
        }),
      }));

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text;
    } catch (error) {
      logger.error('Bedrock translation error:', error);
      throw new Error('Failed to translate content with AI');
    }
  }
}

export const bedrockService = new BedrockService();