using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using Wpf.Ui.Controls;
using Newtonsoft.Json;

namespace Webapp
{
    /// <summary>
    /// About.xaml 的交互逻辑
    /// </summary>
    public partial class About : FluentWindow
    {
        public string appVersion;
        private string latestDownloadUrl;
        private string latestVersion;
        public About()
        {
            InitializeComponent();
            appVersion = Environment.GetEnvironmentVariable("CAPH_VERSION");
            if (string.IsNullOrEmpty(appVersion))
            {
                appVersion = "无";
            }
            currentVer.Text = appVersion;
        }

        private void OpenGithub(object sender, RoutedEventArgs e)
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = "https://github.com/tjy-gitnub/caph/",
                UseShellExecute = true
            });
        }

        private void CheckUpdate(object sender, RoutedEventArgs e)
        {
            var client = new System.Net.WebClient();
            client.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3");
            try
            {
                var json = Newtonsoft.Json.Linq.JArray.Parse(client.DownloadString("https://api.github.com/repos/tjy-gitnub/caph/releases"));

                var latestRelease = json.FirstOrDefault(item => item["draft"].ToObject<bool>() == false);
                var latestVer = latestRelease["tag_name"].ToString();
                if (latestVer == appVersion)
                {
                    infoBar.IsOpen = true;
                    infoBar.Severity = InfoBarSeverity.Success;
                    infoBar.Message = "当前已是最新版本。";
                    updateCard.Visibility = Visibility.Collapsed;
                }
                else
                {
                    infoBar.IsOpen = false;
                    updateCard.Visibility = Visibility.Visible;
                    updateText.Text = "新版本：" + latestVer;
                    latestDownloadUrl = latestRelease["assets"].FirstOrDefault()?["browser_download_url"]?.ToString() ?? "";
                    latestVersion= latestVer;
                    // rar 包，需要替换原程序
                }
            }
            catch (Exception ex)
            {
                infoBar.IsOpen = true;
                infoBar.Severity = InfoBarSeverity.Error;
                infoBar.Message = "检查更新时出错: " + ex.Message;
                updateCard.Visibility = Visibility.Collapsed;
            }
        }
        private void DownloadUpdate(object sender, RoutedEventArgs e)
        {
            if (!string.IsNullOrEmpty(latestDownloadUrl))
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = latestDownloadUrl,
                    UseShellExecute = true
                });
                
            }
        }
        private void ViewUpdate(object sender, RoutedEventArgs e)
        {
            if(!string.IsNullOrEmpty(latestVersion))
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "https://github.com/tjy-gitnub/caph/releases/tag/" + latestVersion,
                    UseShellExecute = true
                });
            }
        }
    }
}