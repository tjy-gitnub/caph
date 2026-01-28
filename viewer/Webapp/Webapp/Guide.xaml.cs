using CefSharp;
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

    public partial class Guide : FluentWindow
    {
        public Guide()
        {
            InitializeComponent();

            cefbguide.JavascriptObjectRepository.Settings.LegacyBindingEnabled = true;
            cefbguide.JavascriptObjectRepository.Register("cefBridge", new JsInterop(), isAsync: false, options: BindingOptions.DefaultBinder);
        }

        private void FluentWindow_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
        {
            if (e.Key == Key.F12)
            {
                cefbguide.ShowDevTools();
            }
        }
    }
}
