using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Forms;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using Wpf.Ui.Appearance;
using Wpf.Ui.Controls;

namespace Webapp
{
    using CefSharp;
    using CefSharp.Wpf;
    using Microsoft.Win32;
    using System;
    using System.Reflection;
    using System.Runtime.InteropServices;
    using System.Threading.Tasks;

    public class ThemeListener : IDisposable
    {
        private const string keyPath = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
        private RegistryKey registryKey;
        private IntPtr registryKeyHandle;
        private bool disposed = false;

        // Win32 API
        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern int RegOpenKeyEx(
            UIntPtr hKey,
            string subKey,
            uint options,
            int samDesired,
            out IntPtr phkResult);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern int RegNotifyChangeKeyValue(
            IntPtr hKey,
            bool watchSubtree,
            uint notifyFilter,
            IntPtr hEvent,
            bool asynchronous);

        private const int KEY_READ = 0x20019;
        private const uint REG_NOTIFY_CHANGE_LAST_SET = 0x00000004;

        public event EventHandler ThemeChanged;

        public ThemeListener()
        {
            registryKey = Registry.CurrentUser.OpenSubKey(keyPath, false);
            // 获取底层句柄
            RegOpenKeyEx((UIntPtr)0x80000001 /*HKEY_CURRENT_USER*/, keyPath, 0, KEY_READ, out registryKeyHandle);
            Task.Run(() => WatchRegistry());
        }

        private void WatchRegistry()
        {
            while (!disposed)
            {
                int result = RegNotifyChangeKeyValue(
                    registryKeyHandle,
                    false,
                    REG_NOTIFY_CHANGE_LAST_SET,
                    IntPtr.Zero,
                    false);

                if (result == 0 && !disposed)
                {
                    ThemeChanged?.Invoke(this, EventArgs.Empty);
                }
            }
        }

        public void Dispose()
        {
            disposed = true;
            registryKey?.Dispose();
            if (registryKeyHandle != IntPtr.Zero)
            {
                Marshal.Release(registryKeyHandle);
                registryKeyHandle = IntPtr.Zero;
            }
        }
    }

    public class JsInterop
    {
        public IWebBrowser browserControl { get; set; }
        public Action animateHideWindow { get; set; }
        public Action openGuideWindow { get; set; }

        public Action openAboutWindow { get; set; }

        public void OpenDevTools()
        {
            browserControl.ShowDevTools();
        }

        public void HideWindow()
        {
            animateHideWindow?.Invoke();
        }

        public void OpenGuide()
        {
            openGuideWindow?.Invoke();
        }

        public void OpenUrl(string url)
        {
            // 在默认浏览器中打开链接
            Process.Start(new ProcessStartInfo
            {
                FileName = "\"" + url + "\"",
                UseShellExecute = true
            });
        }

        public void OpenAbout()
        {
            openAboutWindow?.Invoke();
        }
    }

    public class DownloadHandler : IDownloadHandler
    {

        public bool CanDownload(IWebBrowser browserControl, IBrowser browser, string url, string suggestedFileName)
        {
            return true;
        }

        public bool OnBeforeDownload(
            IWebBrowser browserControl,
            IBrowser browser,
            DownloadItem downloadItem,
            IBeforeDownloadCallback callback)
        {
            if (callback.IsDisposed) return false;

            // 这里指定下载的文件保存路径
            string downloadPath = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                downloadItem.SuggestedFileName);

            // 第二个参数 showDialog=false 表示不弹窗，自动下载
            callback.Continue(downloadPath, showDialog: true);
            return true;
        }

        public void OnDownloadUpdated(
            IWebBrowser browserControl,
            IBrowser browser,
            DownloadItem downloadItem,
            IDownloadItemCallback callback)
        {
            if (downloadItem.IsComplete)
            {
                Process.Start("explorer.exe", $"/select,\"{downloadItem.FullPath}\"");
            }
        }
    }
    public partial class MainWindow
    {
        private NotifyIcon _trayIcon;
        private const double RightMargin = 20; // gap from right edge
        private const double TopMargin = 20;   // gap from top
        private const double BottomMargin = 20; // gap from bottom
        private const double WINDOW_WIDTH = 400; // fixed window width
        private bool _isHidden = false;

        // animation state
        private bool _isAnimating = false;
        private Stopwatch _animWatch;
        private double _animFrom;
        private double _animTo;
        private double _animDurationMs = 300.0;

        public MainWindow()
        {
            InitializeComponent();

            // enforce fixed width and disable resizing
            this.Width = WINDOW_WIDTH;
            this.MinWidth = this.MaxWidth = WINDOW_WIDTH;
            this.ResizeMode = ResizeMode.NoResize;

            Loaded += MainWindow_Loaded;
            SourceInitialized += MainWindow_SourceInitialized;

            //HideButton.Click += HideButton_Click;
            Loaded += (sender, args) =>
            {
                Wpf.Ui.Appearance.SystemThemeWatcher.Watch(
                    this,                                    // Window class
                    Wpf.Ui.Controls.WindowBackdropType.Acrylic, // Background type
                    false                                     // Whether to change accents automatically
                );
            };
            SystemThemeWatcher.Watch(this);

            ThemeListener listener = new ThemeListener();
            listener.ThemeChanged += handle_ThemeChanged;
            handle_ThemeChanged(this, EventArgs.Empty);
            // Initialize tray
            InitTray();

            cefb.JavascriptObjectRepository.Settings.LegacyBindingEnabled = true;
            JsInterop jsInterop = new JsInterop();
            jsInterop.browserControl = cefb;
            jsInterop.animateHideWindow = () =>
            {
                if (_isHidden) return;
                this.Dispatcher.Invoke(() =>
                {
                    AnimateHide(true);
                });
            };
            jsInterop.openGuideWindow = () =>
            {
                this.Dispatcher.Invoke(() =>
                {
                    var guideWindow = new Guide();
                    guideWindow.Show();
                });
            };
            jsInterop.openAboutWindow = () =>
            {
                this.Dispatcher.Invoke(() =>
                {
                    var aboutWindow = new About();
                    aboutWindow.ShowDialog();
                });
            };

            cefb.JavascriptObjectRepository.Register("cefBridge", jsInterop, isAsync: false, options: BindingOptions.DefaultBinder);
            cefb.DownloadHandler = new DownloadHandler();

            cefb.LoadError += Browser_LoadError;

        }

        // 事件处理方法
        private void Browser_LoadError(object sender, CefSharp.LoadErrorEventArgs e)
        {
            // 排除中断导航的特殊情况（比如用户取消）
            if (e.ErrorCode == CefErrorCode.Aborted)
                return;
            string errorHtml = $@"
            <html>
            <head>
                <meta charset='UTF-8'>
                <!--meta http-equiv='refresh' content='3;url={e.FailedUrl}'-->
            </head>
            <body style='font-family:sans-serif;padding-top:50px;display:flex;flex-direction:column;align-items:center;user-select: none;transition:100ms;'>
                <style>.btn{{
                    padding: 7px 18px;
                    font-size: 15px;
                    border-radius: 8px;
                    color: #000;
                    cursor: default;
                    user-select: none;
                    width: max-content;
                    transition: 100ms;
                }}
                .btn.p{{
                    background-color: #61ccff;
                }}
                .btn:hover{{
                    background-color: #ffffff30;
                }}
                .btn.p:hover{{
                    background-color: #7ed6ff;
                }}
                .btn:active{{
                    opacity: 0.6;
                }}
                @media (prefers-color-scheme: dark){{
                    body{{
                        color:#fff;
                    }}
                }}
                </style>
                <h1>错误</h1>
                <p>请检查控制台输出。</p>
                <p style='user-select: text;'>{e.ErrorCode}: {e.ErrorText}</p>
                <div style='display:flex;gap:10px;'>
                    <div class=btn onclick='document.body.style.opacity=0;window.location.href=""{e.FailedUrl}"";'>刷新</div>
                    <div class=btn onclick='window.cefBridge.openDevTools();'>打开 Devtools</div>
                </div>
            </body>
            </html>";
            if (e.ErrorCode == CefErrorCode.ConnectionRefused)
                errorHtml = $@"
                <html>
                <head>
                    <meta charset='UTF-8'>
                    <!--meta http-equiv='refresh' content='3;url={e.FailedUrl}'-->
                </head>
                <body style='font-family:sans-serif;padding-top:50px;display:flex;flex-direction:column;align-items:center;user-select: none;transition:100ms;'>
                    <style>.btn{{
                        padding: 7px 18px;
                        font-size: 15px;
                        border-radius: 8px;
                        cursor: default;
                        user-select: none;
                        width: max-content;
                        transition: 100ms;
                    }}
                    .btn.p{{
                        background-color: #61ccff;
                        color: #000;
                    }}
                    .btn:hover{{
                        background-color: #ffffff20;
                    }}
                    .btn.p:hover{{
                        background-color: #7ed6ff;
                    }}
                    .btn:active{{
                        opacity: 0.6;
                    }}
                    @media (prefers-color-scheme: dark){{
                        body{{
                            color:#fff;
                        }}
                        .detail{{
                            color:#999 !important;
                        }}
                    }}
                    </style>
                    <h1>稍等...</h1>
                    <span>服务端尚未完成初始化。</span>
                    <p>{e.ErrorText}</p>
                    <div style='display:flex;gap:10px;'>
                        <div class='btn p' onclick='document.body.style.opacity=0;window.location.href=""{e.FailedUrl}"";'>刷新</div>
                        <div class=btn onclick='window.cefBridge.openDevTools();'>打开 Devtools</div>
                    </div>
                    <p class=detail style='margin:10px 20px;color:#555;'>若持续遇到此问题，请检查服务端是否启动，或是否被误关闭。</p>
                </body>
                </html>";
            //cefb.ShowDevTools();
            // 加载自定义错误页面
            e.Frame.LoadHtml(errorHtml);
        }

        private void handle_ThemeChanged(object sender, EventArgs e)
        {
            bool isLight = IsLightTheme();
            if (isLight)
            {
                // #ffffff
                //header.Background = new SolidColorBrush(Colors.White);
            }
            else
            {
                // #222222
                //header.Background = new SolidColorBrush(Color.FromRgb(34, 34, 34));
            }
        }

        public static bool IsLightTheme()
        {
            const string keyPath = @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";
            const string valueName = "AppsUseLightTheme";

            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(keyPath))
            {
                if (key != null)
                {
                    object registryValueObject = key.GetValue(valueName);
                    if (registryValueObject != null)
                    {
                        int registryValue = (int)registryValueObject;
                        return registryValue > 0;
                    }
                }
            }
            // 默认浅色主题
            return true;
        }
        private void MainWindow_SourceInitialized(object sender, EventArgs e)
        {
            _trayIcon.Icon = new System.Drawing.Icon(Assembly.GetExecutingAssembly().GetManifestResourceStream(IsLightTheme()? "Webapp.icolight.ico":"Webapp.ico.ico"));
        }

        private void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            // compute vertical size and position (Top and Height), but do not set Left here
            UpdateVerticalSizeAndTop();

            // lock height as fixed as well
            this.MinHeight = this.MaxHeight = this.Height;

            ComputeVisibleHiddenLeft(out double visibleLeft, out double hiddenLeft);
            this.Left = hiddenLeft;
            // ensure Topmost
            this.Topmost = true;
            AnimateHide(false);
        }

        private void UpdateVerticalSizeAndTop()
        {
            var screen = Screen.FromHandle(new WindowInteropHelper(this).Handle);
            var workingArea = screen.WorkingArea; // excludes taskbar

            // convert workingArea (pixels) to device independent units (WPF units)
            double dpiX = 96.0, dpiY = 96.0;
            var source = PresentationSource.FromVisual(this);
            if (source != null)
            {
                dpiX = 96.0 * source.CompositionTarget.TransformToDevice.M11;
                dpiY = 96.0 * source.CompositionTarget.TransformToDevice.M22;
            }

            double scaleX = dpiX / 96.0;

            // Set height to workingArea minus top and bottom margins
            this.Height = (workingArea.Height / scaleX) - TopMargin - BottomMargin;
            this.Top = (workingArea.Top / scaleX) + TopMargin;

            // Do NOT set Left here; Left will be controlled by animation logic to avoid flash
        }

        private void ComputeVisibleHiddenLeft(out double visibleLeft, out double hiddenLeft)
        {
            var screen = Screen.FromHandle(new WindowInteropHelper(this).Handle);
            var workingArea = screen.WorkingArea;

            double dpiX = 96.0;
            var source = PresentationSource.FromVisual(this);
            if (source != null)
            {
                dpiX = 96.0 * source.CompositionTarget.TransformToDevice.M11;
            }
            double scaleX = dpiX / 96.0;

            visibleLeft = (workingArea.Right / scaleX) - RightMargin - this.Width;
            hiddenLeft = (workingArea.Right / scaleX) + 10; // off-screen to right
        }

        // Use per-frame updates to move actual window position for smooth animation including HWND children (WebView2)
        public void AnimateHide(bool hide)
        {
            if (_isAnimating) return;

            ComputeVisibleHiddenLeft(out double visibleLeft, out double hiddenLeft);

            _animFrom = hide ? visibleLeft : hiddenLeft;
            _animTo = hide ? hiddenLeft : visibleLeft;

            // choose easing: hide = ease-in (smooth start), show = ease-out (smooth end)
            IEasingFunction easing = hide ? (IEasingFunction)new QuadraticEase { EasingMode = EasingMode.EaseIn } : new QuadraticEase { EasingMode = EasingMode.EaseOut };

            _animWatch = Stopwatch.StartNew();
            _isAnimating = true;

            // if showing ensure window placed off-screen before showing
            if (!hide)
            {
                this.Left = _animFrom; // start outside
                this.Show();
            }

            CompositionTarget.Rendering += OnRenderingAnimate;

            void OnRenderingAnimate(object s, EventArgs ev)
            {
                double elapsed = _animWatch.Elapsed.TotalMilliseconds;
                double t = Math.Min(1.0, elapsed / _animDurationMs);
                double eased = (easing != null) ? easing.Ease(t) : t;
                double value = _animFrom + (_animTo - _animFrom) * eased;

                // set actual window left so WebView2 moves smoothly
                this.Left = value;

                if (t >= 1.0)
                {
                    CompositionTarget.Rendering -= OnRenderingAnimate;
                    _animWatch.Stop();
                    _isAnimating = false;
                    _isHidden = hide;
                    if (_isHidden)
                        this.Hide();
                    else
                        this.Show();
                }
            }
        }

        private void HideButton_Click(object sender, RoutedEventArgs e)
        {
            if (_isHidden) return;
            AnimateHide(true);
        }

        private void InitTray()
        {
            _trayIcon = new NotifyIcon();
            _trayIcon.Icon = System.Drawing.SystemIcons.Application;
            _trayIcon.Visible = true;
            _trayIcon.Text = "Caph";

            var context = new System.Windows.Forms.ContextMenuStrip();
            var exitItem = new ToolStripMenuItem("退出");
            exitItem.Click += (s, e) => { _trayIcon.Visible = false; System.Windows.Application.Current.Shutdown(); };
            context.Items.Add(exitItem);
            _trayIcon.ContextMenuStrip = context;

            _trayIcon.MouseClick += TrayIcon_MouseClick;
        }

        private void TrayIcon_MouseClick(object sender, System.Windows.Forms.MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                ToggleShowFromTray();
            }
        }

        private void ToggleShowFromTray()
        {
            if (_isHidden || !this.IsVisible)
            {
                // update vertical position/size only (do not set Left to avoid flash)
                UpdateVerticalSizeAndTop();
                // ensure height locked
                this.MinHeight = this.MaxHeight = this.Height;
                // compute off-screen left and set before showing in animation
                ComputeVisibleHiddenLeft(out double visibleLeft, out double hiddenLeft);
                this.Left = hiddenLeft;

                AnimateHide(false);
                this.Activate();
            }
            else
            {
                AnimateHide(true);
            }
        }

        protected override void OnClosed(EventArgs e)
        {
            base.OnClosed(e);
            if (_trayIcon != null)
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
                _trayIcon = null;
            }
        }
    }
}
