// ConfigHelper.ts
import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { EventEmitter } from "events"
import { readEnvOverrides, getEnvSourceLabels, readHardcodedSecrets, type ApiKeySource } from "./envConfig"
import { saveApiCredentialsToEnvFiles, saveGportalToEnvFiles } from "./envFileStore"
import { OpenAI } from "openai"
import {
  type APIProvider,
  DEFAULT_MODELS,
  sanitizeModelSelection
} from "./aiModels"

interface Config {
  apiKey: string;
  apiProvider: "openai" | "gemini" | "anthropic";
  extractionModel: string;
  solutionModel: string;
  debuggingModel: string;
  language: string;
  opacity: number;
  gportalUrl: string;
  gportalUsername: string;
  agentModel: string;
  fontScale: number;
}

/** Runtime config including secrets from .env (password is never written to config.json) */
export interface RuntimeConfig extends Config {
  gportalPassword: string;
  envSources: string[];
  apiKeySource: ApiKeySource;
}

export class ConfigHelper extends EventEmitter {
  private configPath: string;
  private defaultConfig: Config = {
    apiKey: "",
    apiProvider: "openai",
    extractionModel: DEFAULT_MODELS.openai.extraction,
    solutionModel: DEFAULT_MODELS.openai.solution,
    debuggingModel: DEFAULT_MODELS.openai.debugging,
    language: "python",
    opacity: 1.0,
    gportalUrl: "",
    gportalUsername: "",
    agentModel: DEFAULT_MODELS.openai.agent,
    fontScale: 1.0
  };

  constructor() {
    super();
    // Use the app's user data directory to store the config
    try {
      this.configPath = path.join(app.getPath('userData'), 'config.json');
      console.log('Config path:', this.configPath);
    } catch (err) {
      console.warn('Could not access user data path, using fallback');
      this.configPath = path.join(process.cwd(), 'config.json');
    }
    
    // Ensure the initial config file exists
    this.ensureConfigExists();
  }

  /**
   * Ensure config file exists
   */
  private ensureConfigExists(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        this.saveConfig(this.defaultConfig);
      }
    } catch (err) {
      console.error("Error ensuring config exists:", err);
    }
  }

  /**
   * Validate and sanitize model selection to ensure only allowed models are used
   */
  private sanitizeModelSelection(
    model: string,
    provider: "openai" | "gemini" | "anthropic",
    role: "extraction" | "solution" | "debugging" | "agent" = "solution"
  ): string {
    return sanitizeModelSelection(model, provider as APIProvider, role)
  }

  private applyEnvOverrides(config: Config): RuntimeConfig {
    const env = readEnvOverrides()
    const hardcoded = readHardcodedSecrets()
    const merged: RuntimeConfig = {
      ...config,
      gportalPassword: env.gportalPassword ?? hardcoded.gportalPassword ?? "",
      envSources: getEnvSourceLabels(),
      apiKeySource: null
    }

    if (env.apiKey) {
      merged.apiKey = env.apiKey
      merged.apiKeySource = "env"
    } else if (hardcoded.apiKey) {
      merged.apiKey = hardcoded.apiKey
      merged.apiKeySource = "hardcoded"
    } else if (config.apiKey?.trim()) {
      merged.apiKey = config.apiKey
      merged.apiKeySource = "config"
    } else {
      merged.apiKey = ""
    }

    if (env.apiProvider) merged.apiProvider = env.apiProvider
    else if (hardcoded.apiProvider && merged.apiKeySource === "hardcoded") {
      merged.apiProvider = hardcoded.apiProvider
    }

    if (env.gportalUrl) merged.gportalUrl = env.gportalUrl
    else if (hardcoded.gportalUrl) merged.gportalUrl = hardcoded.gportalUrl

    if (env.gportalUsername) merged.gportalUsername = env.gportalUsername
    else if (hardcoded.gportalUsername) merged.gportalUsername = hardcoded.gportalUsername

    if (env.agentModel) {
      merged.agentModel = env.agentModel
      merged.solutionModel = env.agentModel
      merged.extractionModel = env.agentModel
    } else if (hardcoded.agentModel) {
      merged.agentModel = hardcoded.agentModel
      merged.solutionModel = hardcoded.agentModel
      merged.extractionModel = hardcoded.agentModel
    }

    return merged
  }

  public loadConfig(): RuntimeConfig {
    try {
      let base: Config = { ...this.defaultConfig }

      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, "utf8");
        const config = JSON.parse(configData);
        
        if (config.apiProvider !== "openai" && config.apiProvider !== "gemini"  && config.apiProvider !== "anthropic") {
          config.apiProvider = "openai";
        }
        
        if (config.extractionModel) {
          config.extractionModel = this.sanitizeModelSelection(config.extractionModel, config.apiProvider, "extraction");
        }
        if (config.solutionModel) {
          config.solutionModel = this.sanitizeModelSelection(config.solutionModel, config.apiProvider, "solution");
        }
        if (config.debuggingModel) {
          config.debuggingModel = this.sanitizeModelSelection(config.debuggingModel, config.apiProvider, "debugging");
        }
        if (config.agentModel) {
          config.agentModel = this.sanitizeModelSelection(config.agentModel, config.apiProvider, "agent");
        }
        
        base = { ...this.defaultConfig, ...config };
      } else {
        this.saveConfig(this.defaultConfig);
      }

      return this.applyEnvOverrides(base);
    } catch (err) {
      console.error("Error loading config:", err);
      return this.applyEnvOverrides(this.defaultConfig);
    }
  }

  private readConfigFromFile(): Config {
    if (!fs.existsSync(this.configPath)) {
      return { ...this.defaultConfig }
    }
    const config = JSON.parse(fs.readFileSync(this.configPath, "utf8"))
    return { ...this.defaultConfig, ...config }
  }

  /**
   * Save configuration to disk
   */
  public saveConfig(config: Config): void {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write the config file
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (err) {
      console.error("Error saving config:", err);
    }
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<Config>): RuntimeConfig {
    try {
      const currentConfig = this.readConfigFromFile();
      let provider = updates.apiProvider || currentConfig.apiProvider;
      let savedApiKeyToEnv = false;

      // Auto-detect provider based on API key format if a new key is provided
      if (updates.apiKey && !updates.apiProvider) {
        if (updates.apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
          console.log("Auto-detected Anthropic API key format");
        } else if (updates.apiKey.trim().startsWith('sk-')) {
          provider = "openai";
          console.log("Auto-detected OpenAI API key format");
        } else if (updates.apiKey.trim().startsWith('AQ.')) {
          provider = "gemini";
          console.log("Auto-detected Gemini API key format");
        } else {
          provider = "gemini";
          console.log("Using Gemini API key format (default)");
        }
        
        updates.apiProvider = provider;
      }

      if (updates.apiKey !== undefined && updates.apiKey.trim()) {
        saveApiCredentialsToEnvFiles(
          updates.apiKey.trim(),
          provider,
          updates.agentModel ?? updates.solutionModel ?? currentConfig.agentModel
        );
        savedApiKeyToEnv = true;
      } else if (updates.apiProvider && updates.apiProvider !== currentConfig.apiProvider) {
        const runtimeKey = this.applyEnvOverrides(currentConfig).apiKey?.trim()
        if (runtimeKey) {
          saveApiCredentialsToEnvFiles(
            runtimeKey,
            updates.apiProvider,
            updates.agentModel ?? updates.solutionModel ?? currentConfig.agentModel
          );
        }
      }

      const nextGportalUrl = updates.gportalUrl ?? currentConfig.gportalUrl
      const nextGportalUsername = updates.gportalUsername ?? currentConfig.gportalUsername
      if (
        updates.gportalUrl !== undefined ||
        updates.gportalUsername !== undefined
      ) {
        saveGportalToEnvFiles(nextGportalUrl, nextGportalUsername)
      }
      
      // If provider is changing, reset models to the default for that provider
      if (updates.apiProvider && updates.apiProvider !== currentConfig.apiProvider) {
        const defaults = DEFAULT_MODELS[updates.apiProvider as APIProvider]
        updates.extractionModel = defaults.extraction
        updates.solutionModel = defaults.solution
        updates.debuggingModel = defaults.debugging
        updates.agentModel = defaults.agent
      }
      
      // Sanitize model selections in the updates
      if (updates.extractionModel) {
        updates.extractionModel = this.sanitizeModelSelection(updates.extractionModel, provider, "extraction");
      }
      if (updates.solutionModel) {
        updates.solutionModel = this.sanitizeModelSelection(updates.solutionModel, provider, "solution");
      }
      if (updates.debuggingModel) {
        updates.debuggingModel = this.sanitizeModelSelection(updates.debuggingModel, provider, "debugging");
      }
      if (updates.agentModel) {
        updates.agentModel = this.sanitizeModelSelection(updates.agentModel, provider, "agent");
      }
      
      const newConfig = { ...currentConfig, ...updates };
      if (savedApiKeyToEnv) {
        newConfig.apiKey = "";
      }
      this.saveConfig(newConfig);

      const runtime = this.applyEnvOverrides(newConfig);
      
      if (updates.apiKey !== undefined || updates.apiProvider !== undefined || 
          updates.extractionModel !== undefined || updates.solutionModel !== undefined || 
          updates.debuggingModel !== undefined || updates.language !== undefined ||
          updates.gportalUrl !== undefined || updates.gportalUsername !== undefined) {
        this.emit('config-updated', runtime);
      }
      
      return runtime;
    } catch (error) {
      console.error('Error updating config:', error);
      return this.applyEnvOverrides(this.defaultConfig);
    }
  }

  public getGportalPassword(): string {
    return readEnvOverrides().gportalPassword ?? ""
  }

  /**
   * Check if the API key is configured
   */
  public hasApiKey(): boolean {
    const config = this.loadConfig();
    return Boolean(config.apiKey?.trim());
  }
  
  /**
   * Validate the API key format
   */
  public isValidApiKeyFormat(apiKey: string, provider?: "openai" | "gemini" | "anthropic" ): boolean {
    // If provider is not specified, attempt to auto-detect
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        if (apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
        } else {
          provider = "openai";
        }
      } else {
        provider = "gemini";
      }
    }
    
    if (provider === "openai") {
      // Basic format validation for OpenAI API keys
      return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    } else if (provider === "gemini") {
      // Basic format validation for Gemini API keys (usually alphanumeric with no specific prefix)
      return apiKey.trim().length >= 10; // Assuming Gemini keys are at least 10 chars
    } else if (provider === "anthropic") {
      // Basic format validation for Anthropic API keys
      return /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim());
    }
    
    return false;
  }
  
  /**
   * Get the stored opacity value
   */
  public getOpacity(): number {
    const config = this.loadConfig();
    return config.opacity !== undefined ? config.opacity : 1.0;
  }

  /**
   * Set the window opacity value
   */
  public setOpacity(opacity: number): void {
    // Ensure opacity is between 0.1 and 1.0
    const validOpacity = Math.min(1.0, Math.max(0.1, opacity));
    this.updateConfig({ opacity: validOpacity });
  }  
  
  /**
   * Get the preferred programming language
   */
  public getLanguage(): string {
    const config = this.loadConfig();
    return config.language || "python";
  }

  /**
   * Set the preferred programming language
   */
  public setLanguage(language: string): void {
    this.updateConfig({ language });
  }
  
  /**
   * Test API key with the selected provider
   */
  public async testApiKey(apiKey: string, provider?: "openai" | "gemini" | "anthropic"): Promise<{valid: boolean, error?: string}> {
    // Auto-detect provider based on key format if not specified
    if (!provider) {
      if (apiKey.trim().startsWith('sk-')) {
        if (apiKey.trim().startsWith('sk-ant-')) {
          provider = "anthropic";
          console.log("Auto-detected Anthropic API key format for testing");
        } else {
          provider = "openai";
          console.log("Auto-detected OpenAI API key format for testing");
        }
      } else {
        provider = "gemini";
        console.log("Using Gemini API key format for testing (default)");
      }
    }
    
    if (provider === "openai") {
      return this.testOpenAIKey(apiKey);
    } else if (provider === "gemini") {
      return this.testGeminiKey(apiKey);
    } else if (provider === "anthropic") {
      return this.testAnthropicKey(apiKey);
    }
    
    return { valid: false, error: "Unknown API provider" };
  }
  
  /**
   * Test OpenAI API key
   */
  private async testOpenAIKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      const openai = new OpenAI({ apiKey });
      // Make a simple API call to test the key
      await openai.models.list();
      return { valid: true };
    } catch (error: any) {
      console.error('OpenAI API key test failed:', error);
      
      // Determine the specific error type for better error messages
      let errorMessage = 'Unknown error validating OpenAI API key';
      
      if (error.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI key and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded. Your OpenAI API key has reached its request limit or has insufficient quota.';
      } else if (error.status === 500) {
        errorMessage = 'OpenAI server error. Please try again later.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * Test Gemini API key
   * Note: This is a simplified implementation since we don't have the actual Gemini client
   */
  private async testGeminiKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Gemini API and validate the key
      if (apiKey && apiKey.trim().length >= 20) {
        // Here you would actually validate the key with a Gemini API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Gemini API key format.' };
    } catch (error: any) {
      console.error('Gemini API key test failed:', error);
      let errorMessage = 'Unknown error validating Gemini API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Test Anthropic API key
   * Note: This is a simplified implementation since we don't have the actual Anthropic client
   */
  private async testAnthropicKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
      // For now, we'll just do a basic check to ensure the key exists and has valid format
      // In production, you would connect to the Anthropic API and validate the key
      if (apiKey && /^sk-ant-[a-zA-Z0-9]{32,}$/.test(apiKey.trim())) {
        // Here you would actually validate the key with an Anthropic API call
        return { valid: true };
      }
      return { valid: false, error: 'Invalid Anthropic API key format.' };
    } catch (error: any) {
      console.error('Anthropic API key test failed:', error);
      let errorMessage = 'Unknown error validating Anthropic API key';
      
      if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      return { valid: false, error: errorMessage };
    }
  }
}

// Export a singleton instance
export const configHelper = new ConfigHelper();
