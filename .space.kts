@file:DependsOn("com.squareup.okhttp:okhttp:2.7.4", "org.json:json:20200518")

import com.squareup.okhttp.*
import org.json.JSONObject

job("Deploy environment") {
  	startOn {
        gitPush { enabled = true }
    }
    container(image = "node:18-alpine", displayName = "Deploy environment") {
      	env["SPACE_TOKEN"] = Secrets("space-token")
      	env["GITHUB_TOKEN"] = Secrets("github-token")
        shellScript {
            interpreter = "/bin/sh"
            content = """
                echo Install axios...
                npm i axios
                echo Run deployment script...
                node deploy.js
            """
        }
    }
}