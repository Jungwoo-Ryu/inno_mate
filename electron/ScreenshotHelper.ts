// ScreenshotHelper.ts

import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import { v4 as uuidv4 } from "uuid";
import { execFile } from "child_process";
import { promisify } from "util";
import screenshot from "screenshot-desktop";

const execFileAsync = promisify(execFile);

export class ScreenshotHelper {
  private screenshotQueue: string[] = [];
  private extraScreenshotQueue: string[] = [];
  private readonly MAX_SCREENSHOTS = 5;

  private readonly screenshotDir: string;
  private readonly extraScreenshotDir: string;
  private readonly tempDir: string;

  private view: "queue" | "solutions" | "debug" = "queue";
  private getActiveDisplay: (() => Electron.Display | null) | null = null;

  constructor(view: "queue" | "solutions" | "debug" = "queue") {
    this.view = view;

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots");
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    );
    this.tempDir = path.join(
      app.getPath("temp"),
      "innomate-screenshots"
    );

    // Create directories if they don't exist
    this.ensureDirectoriesExist();

    // Clean existing screenshot directories when starting the app
    this.cleanScreenshotDirectories();
  }

  setActiveDisplayProvider(fn: () => Electron.Display | null): void {
    this.getActiveDisplay = fn;
  }

  private ensureDirectoriesExist(): void {
    const directories = [
      this.screenshotDir,
      this.extraScreenshotDir,
      this.tempDir,
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`Created directory: ${dir}`);
        } catch (err) {
          console.error(`Error creating directory ${dir}:`, err);
        }
      }
    }
  }

  // This method replaces loadExistingScreenshots() to ensure we start with empty queues
  private cleanScreenshotDirectories(): void {
    try {
      // Clean main screenshots directory
      if (fs.existsSync(this.screenshotDir)) {
        const files = fs
          .readdirSync(this.screenshotDir)
          .filter((file) => file.endsWith(".png"))
          .map((file) => path.join(this.screenshotDir, file));

        // Delete each screenshot file
        for (const file of files) {
          try {
            fs.unlinkSync(file);
            console.log(`Deleted existing screenshot: ${file}`);
          } catch (err) {
            console.error(`Error deleting screenshot ${file}:`, err);
          }
        }
      }

      // Clean extra screenshots directory
      if (fs.existsSync(this.extraScreenshotDir)) {
        const files = fs
          .readdirSync(this.extraScreenshotDir)
          .filter((file) => file.endsWith(".png"))
          .map((file) => path.join(this.extraScreenshotDir, file));

        // Delete each screenshot file
        for (const file of files) {
          try {
            fs.unlinkSync(file);
            console.log(`Deleted existing extra screenshot: ${file}`);
          } catch (err) {
            console.error(`Error deleting extra screenshot ${file}:`, err);
          }
        }
      }

      console.log("Screenshot directories cleaned successfully");
    } catch (err) {
      console.error("Error cleaning screenshot directories:", err);
    }
  }

  public getView(): "queue" | "solutions" | "debug" {
    return this.view;
  }

  public setView(view: "queue" | "solutions" | "debug"): void {
    console.log("Setting view in ScreenshotHelper:", view);
    console.log(
      "Current queues - Main:",
      this.screenshotQueue,
      "Extra:",
      this.extraScreenshotQueue
    );
    this.view = view;
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue;
  }

  public getExtraScreenshotQueue(): string[] {
    console.log("Getting extra screenshot queue:", this.extraScreenshotQueue);
    return this.extraScreenshotQueue;
  }

  public clearQueues(): void {
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot at ${screenshotPath}:`, err);
      });
    });
    this.screenshotQueue = [];

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err
          );
      });
    });
    this.extraScreenshotQueue = [];
  }

  /**
   * 앱이 위치한 모니터만 전체 캡처 (듀얼 모니터에서 옆 화면 제외)
   */
  private async captureCurrentDisplay(): Promise<Buffer[]> {
    const active = this.getActiveDisplay?.() ?? null
    if (active) {
      console.log(
        `[Screenshot] Active display id=${active.id} bounds=${JSON.stringify(active.bounds)} scale=${active.scaleFactor}`
      )
      try {
        const viaCapturer = await this.captureViaDesktopCapturer(active)
        if (viaCapturer?.length) {
          console.log(
            `[Screenshot] desktopCapturer OK (${viaCapturer.length} bytes)`
          )
          return [viaCapturer]
        }
      } catch (err) {
        console.warn("[Screenshot] desktopCapturer failed:", err)
      }

      if (process.platform === "darwin") {
        try {
          const viaMac = await this.captureMacDisplay(active)
          if (viaMac?.length) {
            console.log(`[Screenshot] macOS screencapture OK (${viaMac.length} bytes)`)
            return [viaMac]
          }
        } catch (err) {
          console.warn("[Screenshot] macOS screencapture failed:", err)
        }
      }

      if (process.platform === "win32") {
        try {
          const viaWin = await this.captureWindowsSingleDisplay(active)
          if (viaWin?.length) {
            console.log(`[Screenshot] Windows single-display OK (${viaWin.length} bytes)`)
            return [viaWin]
          }
        } catch (err) {
          console.warn("[Screenshot] Windows single-display failed:", err)
        }
      }
    }

    // 최후: screenshot-desktop screen id 매칭 (전체 캡처 폴백은 쓰지 않음)
    try {
      const screenId = await this.resolveScreenshotScreenId(active)
      if (screenId != null) {
        console.log(`[Screenshot] screenshot-desktop screen=${screenId}`)
        const buffer = await screenshot({ screen: screenId, format: "png" })
        if (buffer?.length) return [buffer]
      }
    } catch (err) {
      console.warn("[Screenshot] screenshot-desktop screen capture failed:", err)
    }

    throw new Error(
      "현재 모니터 스크린샷에 실패했습니다. 화면 녹화 권한(macOS)을 확인해 주세요."
    )
  }

  /**
   * Electron desktopCapturer — display_id로 단일 모니터 매칭 (가장 신뢰도 높음)
   */
  private async captureViaDesktopCapturer(
    display: Electron.Display
  ): Promise<Buffer | null> {
    const { desktopCapturer } = await import("electron")
    const scale = display.scaleFactor || 1
    const width = Math.max(1, Math.round(display.bounds.width * scale))
    const height = Math.max(1, Math.round(display.bounds.height * scale))

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
      fetchWindowIcons: false
    })

    console.log(
      "[Screenshot] capturer sources:",
      sources.map((s) => ({
        id: s.id,
        display_id: s.display_id,
        name: s.name,
        size: s.thumbnail.getSize()
      }))
    )

    const matched =
      sources.find((s) => s.display_id === String(display.id)) ||
      sources.find((s) => {
        const size = s.thumbnail.getSize()
        return (
          Math.abs(size.width - width) <= 2 &&
          Math.abs(size.height - height) <= 2
        )
      })

    if (!matched) return null

    const size = matched.thumbnail.getSize()
    // 가상 데스크톱(전체 모니터 합본)이면 거부
    if (
      size.width > width * 1.2 ||
      size.height > height * 1.2
    ) {
      console.warn(
        `[Screenshot] Rejecting oversized thumbnail ${size.width}x${size.height} (expected ~${width}x${height})`
      )
      return null
    }

    return matched.thumbnail.toPNG()
  }

  /** macOS: screencapture -D <1-based index> */
  private async captureMacDisplay(
    display: Electron.Display
  ): Promise<Buffer | null> {
    const { screen } = await import("electron")
    const sorted = [...screen.getAllDisplays()].sort(
      (a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y
    )
    const idx = sorted.findIndex((d) => d.id === display.id)
    if (idx < 0) return null

    const displayNumber = idx + 1 // screencapture -D is 1-based
    const tempFile = path.join(this.tempDir, `mac-${uuidv4()}.png`)
    await execFileAsync("screencapture", [
      "-x",
      "-t",
      "png",
      "-D",
      String(displayNumber),
      tempFile
    ])

    if (!fs.existsSync(tempFile)) return null
    const buffer = await fs.promises.readFile(tempFile)
    try {
      await fs.promises.unlink(tempFile)
    } catch {
      /* ignore */
    }
    return buffer.length ? buffer : null
  }

  /** Windows: 지정 모니터 Bounds만 CopyFromScreen */
  private async captureWindowsSingleDisplay(
    display: Electron.Display
  ): Promise<Buffer | null> {
    const tempFile = path.join(this.tempDir, `win-${uuidv4()}.png`)
    const { x, y, width, height } = display.bounds
    const psScript = `
      Add-Type -AssemblyName System.Drawing
      $bmp = New-Object System.Drawing.Bitmap ${width}, ${height}
      $graphics = [System.Drawing.Graphics]::FromImage($bmp)
      $graphics.CopyFromScreen(${x}, ${y}, 0, 0, (New-Object System.Drawing.Size(${width}, ${height})))
      $bmp.Save('${tempFile.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bmp.Dispose()
    `
    await execFileAsync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      psScript
    ])
    if (!fs.existsSync(tempFile)) return null
    const buffer = await fs.promises.readFile(tempFile)
    try {
      await fs.promises.unlink(tempFile)
    } catch {
      /* ignore */
    }
    return buffer.length ? buffer : null
  }

  /** Electron Display ↔ screenshot-desktop screen id 매칭 */
  private async resolveScreenshotScreenId(
    active: Electron.Display | null
  ): Promise<number | string | undefined> {
    const listed = await screenshot.listDisplays()
    if (!listed.length) return undefined
    if (!active || listed.length === 1) {
      return listed[0].id
    }

    const { screen } = await import("electron")
    const sortedElectron = [...screen.getAllDisplays()].sort(
      (a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y
    )
    const idx = sortedElectron.findIndex((d) => d.id === active.id)
    if (idx >= 0 && idx < listed.length) {
      return listed[idx].id
    }

    // name/bounds 힌트로 재매칭 시도
    const byName = listed.find((d) =>
      String(d.name || "")
        .toLowerCase()
        .includes(String(active.id))
    )
    if (byName) return byName.id

    return listed[Math.min(Math.max(idx, 0), listed.length - 1)]?.id
  }

  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string[]> {
    console.log("Taking screenshot in view:", this.view);

    // hide 전에 현재 디스플레이를 확정 (hide 후에도 bounds는 유지되지만 명시적으로 고정)
    const lockedDisplay = this.getActiveDisplay?.() ?? null
    if (lockedDisplay) {
      const previous = this.getActiveDisplay
      this.getActiveDisplay = () => lockedDisplay
      try {
        return await this.takeScreenshotInner(hideMainWindow, showMainWindow)
      } finally {
        this.getActiveDisplay = previous
      }
    }

    return this.takeScreenshotInner(hideMainWindow, showMainWindow)
  }

  private async takeScreenshotInner(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string[]> {
    hideMainWindow();

    const hideDelay = process.platform === "win32" ? 500 : 300;
    await new Promise((resolve) => setTimeout(resolve, hideDelay));

    const savedPaths: string[] = [];
    try {
      const screenshotBuffers = await this.captureCurrentDisplay();

      for (const screenshotBuffer of screenshotBuffers) {
        if (!screenshotBuffer || screenshotBuffer.length === 0) {
          continue;
        }

        let screenshotPath = "";
        if (this.view === "queue") {
          screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
          await fs.promises.writeFile(screenshotPath, screenshotBuffer);
          this.screenshotQueue.push(screenshotPath);
          while (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
            const removedPath = this.screenshotQueue.shift();
            if (removedPath) {
              try {
                await fs.promises.unlink(removedPath);
              } catch (error) {
                console.error("Error removing old screenshot:", error);
              }
            }
          }
        } else {
          screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`);
          await fs.promises.writeFile(screenshotPath, screenshotBuffer);
          this.extraScreenshotQueue.push(screenshotPath);
          while (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
            const removedPath = this.extraScreenshotQueue.shift();
            if (removedPath) {
              try {
                await fs.promises.unlink(removedPath);
              } catch (error) {
                console.error("Error removing old screenshot:", error);
              }
            }
          }
        }
        savedPaths.push(screenshotPath);
      }

      if (savedPaths.length === 0) {
        throw new Error("Screenshot capture returned empty buffer");
      }
    } catch (error) {
      console.error("Screenshot error:", error);
      throw error;
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 200));
      showMainWindow();
    }

    return savedPaths;
  }

  public async getImagePreview(filepath: string): Promise<string> {
    try {
      if (!fs.existsSync(filepath)) {
        console.error(`Image file not found: ${filepath}`);
        return "";
      }

      const data = await fs.promises.readFile(filepath);
      return `data:image/png;base64,${data.toString("base64")}`;
    } catch (error) {
      console.error("Error reading image:", error);
      return "";
    }
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (fs.existsSync(path)) {
        await fs.promises.unlink(path);
      }

      if (this.view === "queue") {
        this.screenshotQueue = this.screenshotQueue.filter(
          (filePath) => filePath !== path
        );
      } else {
        this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
          (filePath) => filePath !== path
        );
      }
      return { success: true };
    } catch (error) {
      console.error("Error deleting file:", error);
      return { success: false, error: error.message };
    }
  }

  public clearExtraScreenshotQueue(): void {
    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      if (fs.existsSync(screenshotPath)) {
        fs.unlink(screenshotPath, (err) => {
          if (err)
            console.error(
              `Error deleting extra screenshot at ${screenshotPath}:`,
              err
            );
        });
      }
    });
    this.extraScreenshotQueue = [];
  }
}
