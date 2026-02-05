/**
 * analyze_media Tool
 *
 * Analyzes images and videos to understand their content before adding animations.
 * - Images: Uses Claude Vision via Mastra agent
 * - Videos: Uses Gemini 3 Flash for native video understanding
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';

// Schema for scene analysis
const SceneAnalysisSchema = z.object({
  startTime: z.number().describe('Start time in seconds'),
  endTime: z.number().describe('End time in seconds'),
  description: z.string().describe('What is happening in this scene'),
  objects: z.array(z.string()).describe('Key objects/subjects visible'),
  movement: z.string().describe('Type of movement/motion in the scene'),
  mood: z.string().describe('Emotional tone or atmosphere'),
  colors: z.array(z.string()).describe('Dominant colors'),
});

const MediaAnalysisResultSchema = z.object({
  success: z.boolean(),
  mediaType: z.enum(['image', 'video']),
  duration: z.number().optional().describe('Duration in seconds (videos only)'),
  width: z.number().optional(),
  height: z.number().optional(),
  scenes: z.array(SceneAnalysisSchema),
  overallDescription: z.string().describe('Summary of the entire media'),
  suggestedAnimations: z.array(z.string()).describe('Animation ideas that would work well'),
  audioDescription: z.string().optional().describe('Description of audio/music (videos only)'),
  error: z.string().optional(),
});

// Analysis prompt templates
const IMAGE_ANALYSIS_PROMPT = `Analyze this image for animation planning. Return a JSON object with:

{
  "overallDescription": "Detailed description of the image",
  "scenes": [{
    "startTime": 0,
    "endTime": 0,
    "description": "What's in the image",
    "objects": ["list", "of", "objects"],
    "movement": "static/implied movement",
    "mood": "emotional tone",
    "colors": ["dominant", "colors"]
  }],
  "suggestedAnimations": [
    "Animation ideas that would enhance this image",
    "Consider: parallax, zoom, pan, particle effects, text overlays, transitions"
  ]
}

Be specific about positions, sizes, and relationships between elements. Think about what animations would bring this image to life.`;

const VIDEO_ANALYSIS_PROMPT = `Analyze this video for animation overlay planning. I want to add motion graphics and animations on top of this video.

Return a JSON object with:

{
  "overallDescription": "Summary of the entire video",
  "duration": <duration in seconds>,
  "scenes": [
    {
      "startTime": <seconds>,
      "endTime": <seconds>,
      "description": "What happens in this scene",
      "objects": ["key", "subjects", "visible"],
      "movement": "camera movement or subject motion",
      "mood": "emotional tone",
      "colors": ["dominant", "colors"]
    }
  ],
  "audioDescription": "Description of music, speech, or sound effects",
  "suggestedAnimations": [
    "Specific animation ideas with timestamps",
    "Consider: text reveals synced to speech, particle effects on beats, lower thirds, transitions between scenes"
  ]
}

Pay attention to:
- Scene changes and cuts
- Camera movements (pan, zoom, tracking)
- Key moments that could be enhanced with graphics
- Audio beats and rhythm for syncing animations
- Safe areas for text overlays (avoid faces, important action)`;

/**
 * Claude Image Analyzer Agent (Mastra)
 */
const claudeImageAnalyzer = new Agent({
  id: 'claude-image-analyzer',
  name: 'claude-image-analyzer',
  instructions: `You are an image analysis expert. Analyze images and return structured JSON for animation planning.
Always return valid JSON matching the requested schema. Be detailed about composition, objects, and animation opportunities.`,
  model: 'anthropic/claude-opus-4-5',
});

/**
 * Gemini Video Analyzer Agent (Mastra)
 */
const geminiVideoAnalyzer = new Agent({
  id: 'gemini-video-analyzer',
  name: 'gemini-video-analyzer',
  instructions: `You are a video analysis expert. Analyze videos and return structured JSON for animation planning.
Always return valid JSON matching the requested schema. Be detailed about timestamps, scene changes, and animation opportunities.`,
  model: 'google/gemini-3-flash-preview',
});

/**
 * Analyze image using Claude Vision via Mastra
 */
async function analyzeImageWithClaude(
  imageUrl: string,
  imageBase64?: string,
  mimeType?: string
): Promise<z.infer<typeof MediaAnalysisResultSchema>> {
  try {
    // Build multimodal content for Mastra
    const imageContent: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [];

    // Add image - Mastra accepts URL or base64
    if (imageBase64) {
      imageContent.push({
        type: 'image',
        image: `data:${mimeType || 'image/png'};base64,${imageBase64}`,
      });
    } else {
      imageContent.push({
        type: 'image',
        image: imageUrl,
      });
    }

    // Add the analysis prompt
    imageContent.push({
      type: 'text',
      text: IMAGE_ANALYSIS_PROMPT,
    });

    const result = await claudeImageAnalyzer.generate([
      {
        role: 'user',
        content: imageContent as any,
      },
    ]);

    const responseText = result.text || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        mediaType: 'image',
        scenes: [],
        overallDescription: responseText,
        suggestedAnimations: [],
        error: 'Failed to parse structured response',
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        mediaType: 'image',
        scenes: parsed.scenes || [],
        overallDescription: parsed.overallDescription || '',
        suggestedAnimations: parsed.suggestedAnimations || [],
      };
    } catch {
      return {
        success: false,
        mediaType: 'image',
        scenes: [],
        overallDescription: responseText,
        suggestedAnimations: [],
        error: 'Failed to parse JSON response',
      };
    }
  } catch (error) {
    return {
      success: false,
      mediaType: 'image',
      scenes: [],
      overallDescription: '',
      suggestedAnimations: [],
      error: `Claude API error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Analyze video using Gemini 3 Flash via Mastra
 */
async function analyzeVideoWithGemini(
  videoUrl: string,
  videoBase64?: string,
  mimeType?: string
): Promise<z.infer<typeof MediaAnalysisResultSchema>> {
  try {
    // Build the message with video
    // Mastra/Gemini supports video via URL or base64
    const videoContent: Array<{ type: 'text'; text: string } | { type: 'file'; file: { url: string } } | { type: 'file'; file: { base64: string; mimeType: string } }> = [];

    if (videoBase64 && mimeType) {
      videoContent.push({
        type: 'file',
        file: {
          base64: videoBase64,
          mimeType: mimeType,
        },
      });
    } else {
      videoContent.push({
        type: 'file',
        file: {
          url: videoUrl,
        },
      });
    }

    videoContent.push({
      type: 'text',
      text: VIDEO_ANALYSIS_PROMPT,
    });

    const result = await geminiVideoAnalyzer.generate([
      {
        role: 'user',
        content: videoContent as any, // Mastra accepts this format for multimodal
      },
    ]);

    const responseText = result.text || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        mediaType: 'video',
        scenes: [],
        overallDescription: responseText,
        suggestedAnimations: [],
        error: 'Failed to parse structured response from Gemini',
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        mediaType: 'video',
        duration: parsed.duration,
        scenes: parsed.scenes || [],
        overallDescription: parsed.overallDescription || '',
        suggestedAnimations: parsed.suggestedAnimations || [],
        audioDescription: parsed.audioDescription,
      };
    } catch {
      return {
        success: false,
        mediaType: 'video',
        scenes: [],
        overallDescription: responseText,
        suggestedAnimations: [],
        error: 'Failed to parse JSON response from Gemini',
      };
    }
  } catch (error) {
    return {
      success: false,
      mediaType: 'video',
      scenes: [],
      overallDescription: '',
      suggestedAnimations: [],
      error: `Gemini API error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Detect media type from URL or mime type
 */
function detectMediaType(url: string, mimeType?: string): 'image' | 'video' {
  if (mimeType) {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('image/')) return 'image';
  }

  const ext = url.split('.').pop()?.toLowerCase().split('?')[0]; // Handle query params
  const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];

  if (videoExtensions.includes(ext || '')) return 'video';
  if (imageExtensions.includes(ext || '')) return 'image';

  // Default to image if unclear
  return 'image';
}

export const analyzeMediaTool = createTool({
  id: 'analyze_media',
  description: `Analyze an image or video to understand its content before adding animations.

Use this tool when:
- User uploads/provides an image they want animated
- User uploads/provides a video they want to add overlays/effects to
- You need to understand the visual content to plan appropriate animations

For images: Uses Claude Vision for detailed analysis
For videos: Uses Gemini 3 Flash for native video understanding (motion, audio, scenes)

Returns:
- Scene-by-scene breakdown with timestamps (for videos)
- Objects, movements, colors, and mood
- Suggested animations that would work well with the content

Example:
- Input: Product photo
- Output: Scene analysis + suggestions like "zoom on product, particle sparkles, text reveal with product name"

- Input: Interview video
- Output: Scene breakdown with speaker changes, suggested lower thirds, text overlays synced to speech`,

  inputSchema: z.object({
    mediaUrl: z.string().describe('URL of the image or video to analyze'),
    mediaBase64: z.string().optional().describe('Base64-encoded media data (alternative to URL)'),
    mimeType: z.string().optional().describe('MIME type of the media (e.g., image/png, video/mp4)'),
    mediaType: z.enum(['image', 'video']).optional().describe('Force media type detection'),
    focusAreas: z.array(z.string()).optional().describe('Specific aspects to focus on (e.g., "faces", "text", "products")'),
  }),

  outputSchema: MediaAnalysisResultSchema,

  execute: async (input) => {
    const { mediaUrl, mediaBase64, mimeType } = input;

    // Detect media type
    const detectedType = input.mediaType || detectMediaType(mediaUrl, mimeType);

    console.log(`[analyze_media] Analyzing ${detectedType}: ${mediaUrl?.slice(0, 50)}...`);

    try {
      if (detectedType === 'video') {
        return await analyzeVideoWithGemini(mediaUrl, mediaBase64, mimeType);
      } else {
        return await analyzeImageWithClaude(mediaUrl, mediaBase64, mimeType);
      }
    } catch (error) {
      return {
        success: false,
        mediaType: detectedType,
        scenes: [],
        overallDescription: '',
        suggestedAnimations: [],
        error: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

export { SceneAnalysisSchema, MediaAnalysisResultSchema };
