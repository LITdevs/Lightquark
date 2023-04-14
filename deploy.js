let token = process.env.SPACE_TOKEN;
import axios from "axios";
import {exec} from "child_process";

let environment;

// Get git branch
exec("git rev-parse --abbrev-ref HEAD", (error, stdout, stderr) => {
	environment = stdout.trim();
	console.log(`Environment: ${environment}`);
	environment = environment === "dev" ? "lightquark-dev" : "lightquark"
	console.log(`App name: ${environment}`);
	console.log(`Token: ${token}`)

	axios.post("https://ems-api.litdevs.org/v1/pm2/spacespull", {
		token: token,
		appName: environment
	}).then((res) => {
		console.log(res.data);
	});
})
