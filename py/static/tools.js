// 工具定义与处理

const av_tools = [
    {
        type: "function",
        function: {
            name: "run_cmd",
            description:
                `运行 cmd 命令，并返回命令的输出结果。环境: Windows11 x64。`,
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "命令",
                    },
                },
                required: ['command'],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "open_url",
            description:
                `在默认浏览器中打开链接。（若在搜索时，请避免使用 Google）`,
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "URL",
                    },
                },
                required: ['url'],
            },
        },
    },
    
    {
        type: "function",
        function: {
            name: "change_directory",
            description: `切换当前工作目录。在进行文件操作时，只允许读取和操作工作目录内的内容。你可以通过这个工具来请求切换到其它工作目录。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "目标" }
                },
                required: ['path']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "list_directory",
            description: `列出指定目录下的文件和文件夹。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "目录路径，可选，默认为 \".\" 。" }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_file",
            description: `创建新文件（会创建父目录）。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "相对或绝对路径" },
                    content: { type: "string", description: "可选，文件内容" }
                },
                required: ['path']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "create_folder",
            description: `创建新文件夹（会创建父目录）。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "相对或绝对路径" },
                },
                required: ['path']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "delete_file_or_folder",
            description: `删除文件或文件夹（文件夹会递归删除）。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "要删除的文件/文件夹路径" }
                },
                required: ['path']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "move_file_or_folder",
            description: `移动文件或文件夹到目标。`,
            parameters: {
                type: "object",
                properties: {
                    src: { type: "string", description: "源文件/文件夹的路径" },
                    dst: { type: "string", description: "目标文件/文件夹的路径" }
                },
                required: ['src', 'dst']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "copy_file_or_folder",
            description: `复制文件或文件夹。`,
            parameters: {
                type: "object",
                properties: {
                    src: { type: "string", description: "源文件/文件夹的路径" },
                    dst: { type: "string", description: "目标文件/文件夹的路径" }
                },
                required: ['src', 'dst']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "rename_file_or_folder",
            description: `重命名文件或文件夹。`,
            parameters: {
                type: "object",
                properties: {
                    src: { type: "string" },
                    new_name: { type: "string" }
                },
                required: ['src', 'new_name']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_file_or_folder_props",
            description: `获取文件/文件夹属性（包括绝对路径、大小、时间等）。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "文件/文件夹路径" }
                },
                required: ['path']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "open_file",
            description: `用默认应用打开文件。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "文件路径" }
                },
                required: ['path']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "reveal_in_explorer",
            description: `在文件资源管理器中选中文件/文件夹，向用户展示。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "文件/文件夹路径" }
                },
                required: ['path']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_file",
            description: `读取受限扩展名的文本内容（.txt .md .py .json .csv .log）。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "文件路径" },
                    encoding: { type: "string", description: "可选，默认 utf-8" }
                },
                required: ['path']
            }
        }
    },
    {
        type: "function",
        function: {
            name: "write_file",
            description: `向文件写入文本内容。`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "文件路径" },
                    content: { type: "string", description: "要写入的内容" },
                    encoding: { type: "string", description: "可选，默认 utf-8" }
                },
                required: ['path', 'content']
            }
        }
    },
];

// 返回值为 string 或 JSON（可为 Promise）
// 需要在 python 后端中实现对应请求 (在 /py/caph/urls.py 中注册，在 /py/caph/views.py 中实现)

function call_tool(toolname) {
    return function (c) {
        return $.post('/tool/' + toolname, c).then(data => data).catch(r => {
            return `[命令执行失败: ${r.status} ${r.statusText}]`;
        });
    }
}
function call_tool_with_cwd(toolname) {
    return function (c) {
        const cwd_now = convManager.getcwd();
        if (cwd_now) c.cwd = cwd_now;
        return $.post('/tool/' + toolname, c).then(data => data).catch(r => {
            return `[命令执行失败: ${r.status} ${r.statusText}]`;
        });
    }
}

const tool_handlers = {
    run_cmd: call_tool('run_cmd'),
    open_url: call_tool('open_url'),

    change_directory: (args) => {
        // 调用处会特殊处理
        return $.post('/tool/change_directory', args).then(data => {
            return data;
        })
    },
    list_directory: call_tool_with_cwd('list_directory'),
    create_file: call_tool_with_cwd('create_file'),
    create_folder: call_tool_with_cwd('create_folder'),
    delete_file_or_folder: call_tool_with_cwd('delete_file_or_folder'),
    move_file_or_folder: call_tool_with_cwd('move_file_or_folder'),
    copy_file_or_folder: call_tool_with_cwd('copy_file_or_folder'),
    rename_file_or_folder: call_tool_with_cwd('rename_file_or_folder'),
    get_file_or_folder_props: call_tool_with_cwd('get_file_or_folder_props'),
    open_file: call_tool_with_cwd('open_file'),
    reveal_in_explorer: call_tool_with_cwd('reveal_in_explorer'),
    read_file: call_tool_with_cwd('read_file'),
    write_file: call_tool_with_cwd('write_file'),
};

const tool_describers = {
    run_cmd: (args) => {
        return `运行 cmd 命令 <code>${args.command}</code>`;
    },
    open_url: (args) => {
        return `打开链接 <code>${args.url}</code>`;
    },

    change_directory: (args) => `切换工作目录到 <code>${args.path}</code>`,
    list_directory: (args) => `列出 <code>${args.path || '工作目录'}</code> 下的内容`,
    create_file: (args) => `新建文件 <code>${args.path}</code>`+(args.content?`，并写入 <code>${args.content.length > 20?args.content.substring(0,20)+'...':args.content}</code>`:''),
    create_folder: (args) => `新建文件夹 <code>${args.path}</code>`,
    delete_file_or_folder: (args) => `删除 <code>${args.path}</code>`,
    move_file_or_folder: (args) => `移动 <code>${args.src}</code> 到 <code>${args.dst}</code>`,
    copy_file_or_folder: (args) => `复制 <code>${args.src}</code> 到 <code>${args.dst}</code>`,
    rename_file_or_folder: (args) => `重命名 <code>${args.src}</code> 为 <code>${args.new_name}</code>`,
    get_file_or_folder_props: (args) => `获取 <code>${args.path}</code> 的属性`,
    open_file: (args) => `打开 <code>${args.path}</code>`,
    reveal_in_explorer: (args) => `向你展示 <code>${args.path}</code>`,
    read_file: (args) => `阅读 <code>${args.path}</code>`,
    write_file: (args) => `向 <code>${args.path}</code> 写入内容`+(args.content?` <code>${args.content.length > 20?args.content.substring(0,20)+'...':args.content}</code>`:''),
};