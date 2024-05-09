import { spawn} from 'child_process';

function spawnProcess() {
    for (let i=0; i<10; i++){
        const childProcess = spawn('node intention_revision.js', {shell: true});
    };
};

spawnProcess();