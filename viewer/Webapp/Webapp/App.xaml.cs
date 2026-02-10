using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Diagnostics;
using System.Linq;
using System.Management;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;

namespace Webapp
{
    /// <summary>
    /// App.xaml 的交互逻辑
    /// </summary>
    public partial class App : Application
    {
        public App()
        {
            AppDomain.CurrentDomain.AssemblyResolve += ResolveDllFromSubfolder;
            Environment.SetEnvironmentVariable("CAPH_VERSION", "v2.2", EnvironmentVariableTarget.Process);
        }

        private Process _childProcess;

        private Assembly ResolveDllFromSubfolder(object sender, ResolveEventArgs args)
        {
            string dllName = new AssemblyName(args.Name).Name + ".dll";
            string path = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "_", dllName);
            if (System.IO.File.Exists(path))
            {
                return Assembly.LoadFrom(path);
            }
            return null;
        }
        private void StartChildProcess()
        {
            try
            {
                _childProcess = new Process();
                _childProcess.StartInfo.FileName = ".\\_\\django.exe";
                _childProcess.StartInfo.Arguments = "runserver 777 --noreload --skip-checks";
                _childProcess.StartInfo.UseShellExecute = true;
                _childProcess.StartInfo.CreateNoWindow = true;
                _childProcess.StartInfo.WindowStyle = ProcessWindowStyle.Hidden;
                _childProcess.Start();
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show("启动子进程失败: " + ex.Message);
            }
        }
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            if (!Environment.GetCommandLineArgs().Contains("--debug"))
            {
                StartChildProcess();
            }
        }
        void KillProcessAndChildren(int pid)
        {
            ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                $"Select * From Win32_Process Where ParentProcessID={pid}");
            foreach (ManagementObject mo in searcher.Get())
            {
                KillProcessAndChildren(Convert.ToInt32(mo["ProcessID"]));
            }
            try
            {
                Process.GetProcessById(pid).Kill();
            }
            catch { }
        }

        protected override void OnExit(ExitEventArgs e)
        {
            base.OnExit(e);
            try
            {
                if (_childProcess != null && !_childProcess.HasExited)
                {
                    KillProcessAndChildren(_childProcess.Id);
                }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show("终止子进程失败: " + ex.Message);
            }
        }
    }
}
