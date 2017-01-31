#sockscode-vscode

Enables pair programming. Share your code with your buddies. 

To start a pair programming session: 

1. Press F1
2. Enter 'Sockscode create a new room.';
3. You'll receive roomUuid - you'll need to send this uuid to your buddies.
4. Your buddies'll need to press F1 and enter 'Sockscode connect to a room.'
5. Want to exit session? F1 and Sockscode disconnect.

Don't use vscode? You can use https://sockscode.azurewebsites.net/ too.

This add-in provides you a way to have a pair coding session with any other sockscode compatible plugins:
* sockscode-office
* sockscode-web

##Privacy
Anyone with the roomUuid can join your session and see your code. 
If you want to use this extension in your corporate environment you should deploy your own sockscode-server 
https://github.com/sockscode/sockscode-server and set 'sockscode.server' property for sockscode-vscode extension.

##Commands

List of commands:
```json
{
"commands": [

            {
                "command": "sockscode.createRoom",
                "title": "Sockscode create a new room."
            },
            {
                "command": "sockscode.connect",
                "title": "Sockscode connect to a room."
            },
            {
                "command": "sockscode.disconnect",
                "title": "Sockscode disconect."
            }
        ]
}
```