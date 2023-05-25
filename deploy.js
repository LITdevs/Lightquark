const token = process.env.SPACE_TOKEN;
const environment = process.env.JB_SPACE_GIT_BRANCH === "refs/heads/dev" ? "lightquark-dev" : "lightquark";
console.log("Branch: ", process.env.JB_SPACE_GIT_BRANCH);
import axios from "axios";

console.log(`App name: ${environment}`);
console.log(`Token: ${token}`);

axios.post("https://ems-api.litdevs.org/v1/pm2/spacespull", {
	token: token,
	appName: environment,
	updateDependencies: true
}).then((res) => {
	console.log(res.data);
	axios.post(`https://api.github.com/repos/LITdevs/Lightquark/commits/${process.env.JB_SPACE_GIT_REVISION}/comments`, {
			body: `Deployment to ${environment}\n${JSON.stringify(res.data)}`
		}, {
		headers: {
			Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
		}
	}).then((res) => {
		console.log(res.data);
	})
});