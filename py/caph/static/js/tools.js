// 工具定义与处理


const av_tools = [
    {
        type: "function",
        function: {
            name: "run_cmd",
            description:
                `运行 cmd 命令。环境: Windows11 x64。当前目录在 E: 盘。`,
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
    // {
    //     type: "function",
    //     function: {
    //         name: "run_python",
    //         description:
    //             `运行 python 代码。环境: Python 3.9。请先向用户说明运行的理由、预期效果、注意事项等。`,
    //         parameters: {
    //             type: "object",
    //             properties: {
    //                 code: {
    //                   type: "string",
    //                   description: "代码",
    //                 },
    //             },
    //             required: ['code'],
    //         },
    //     },
    // },
];

// 返回值为 string 或 JSON（可为 Promise）
const tool_handlers = {
    run_cmd: (c) => {
        return $.post('/tool/run_cmd', { command: c.command }).then(data => data);
    },
    // run_python: () => {
    //     return '[用户已拒绝]';
    // },
};