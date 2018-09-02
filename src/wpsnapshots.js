const commandUtils = require( './command-utils' );
const fs = require( 'fs-extra' );
const path = require( 'path' );
const execSync = require('child_process').execSync;
const envUtils = require('./env-utils');
const gateway = require( './gateway' );
const config = require( './configure' );

const command = async function() {
    // false catches the case when no subcommand is passed, and we just pass to snapshots to show usage
    let bypassCommands = [ undefined, 'configure', 'help', 'list' ];
    let noPathCommands = [ undefined, 'configure', 'help', 'list', 'delete', 'search', 'download' ];
    let envPath = false;

    // Ensure that the wpsnapshots folder is created and owned by the current user versus letting docker create it so we can enforce proper ownership later
    let wpsnapshotsDir = path.join( config.getConfigDirectory(), 'wpsnapshots' );
    await fs.ensureDir( wpsnapshotsDir );

    // Except for a few whitelisted commands, enforce a configuration before proceeding
    if ( bypassCommands.indexOf( commandUtils.subcommand() ) === -1 ) {
        // Verify we have a configuration
        if ( fs.existsSync( path.join( wpsnapshotsDir, 'config.json' ) ) === false ) {
            console.error( "Error: WP Snapshots does not have a configuration file. Please run '10updocker wpsnapshots configure' before continuing." );
            process.exit();
        }
    }

    // These commands can be run without being in the context of a WP install
    if ( noPathCommands.indexOf( commandUtils.subcommand() ) === -1 ) {
        // @todo allow users to specify environment an alternate way
        let envSlug = await envUtils.parseEnvFromCWD();
        if ( envSlug === false ) {
            console.error( "Error: Unable to determine which environment to use wp snapshots with. Please run this command from within your environment." );
            process.exit(1);
        }
        envPath = await envUtils.envPath( envSlug );
    }

    // Get everything after the snapshots command, so we can pass to the docker container
    let command = commandUtils.commandArgs();

    // @todo update the image version once new images are merged
    try{
        if ( envPath === false ) {
            execSync( `docker run -it --rm -v ${wpsnapshotsDir}:/home/wpsnapshots/.wpsnapshots 10up/wpsnapshots:dev ${command}`, { stdio: 'inherit' });
        } else {
            await gateway.startGlobal();
            execSync( `docker run -it --rm --network wplocaldocker -v ${envPath}/wordpress:/var/www/html -v ${wpsnapshotsDir}:/home/wpsnapshots/.wpsnapshots 10up/wpsnapshots:dev ${command}`, { stdio: 'inherit' });
        }
    } catch (ex) {}
};

module.exports = { command };