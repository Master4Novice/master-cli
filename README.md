# @master4n/master-cli

![Owner Badge](https://img.shields.io/badge/Owner-Master4Novice-orange?style=flat)
![Package License](https://img.shields.io/npm/l/%40master4n%2Fmaster-cli)
![Package Downloads](https://img.shields.io/npm/dm/%40master4n%2Fmaster-cli)

## Installation

```sh
npm install -g @master4n/master-cli
```

## Summary

This package contains master-cli.

## Details

Use below command for help and options.

```shell
mfn -h # For help
mfn -v # For installed version of master-cli
mfn [command] -h # For help on specific command
```

## Examples

| Command                    | Option                                                       | Required             | Description                                                                                                                     |
| -------------------------- | ------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| mfn md                     | -d myRootFolder                                              | -d ( required )      | Make directory 'myRootFolder' inside current working directory                                                                  |
| mfn md                     | -d myRootFolder -s subFolder1 subFolder2                     | -s ( optional )      | Make directory 'myRootFolder' inside current working directory and subdirectories [subFolder1, subFolder2] inside 'myRootFolder |
| mfn cts                    | -t [svg/png/jpeg]                                            | -t ( required )      | Save tree structure of content of current working directory in provided file type                                               |
| mfn cts                    | -t svg -l 300 -b 250                                         | -l & -b ( optional ) | Save file in a provided dimension                                                                                               |
| mfn cts                    | -t svg -l 300 -b 250 -i .idea .bin node_modules package.json | -i ( optional )      | It will ignore provided files and folders while creating tree structure                                                         |
| mfn sc                     | -i .idea .bin node_modules package.json                      | -i ( optional )      | It will help user to search the content of current working directory while ignoring provided files and folders from search list |
| mfn hra                    | --mb 2000 --mr 800 --hr 750 --im true                        | -im ( optional )     | It will calculate your HRA. For India Exemption                                                                                 |
| mfn sr                     | --mb 2000 --hr 750 --im true                                 | -im ( optional )     | It will provide you calculated value of rent that will maximize your HRA. For India Exemption                                   |
| mfn decode                 | -t 'valid token'                                             |                      | It will decode provided JWT token and display decoded result                                                                    |
| mfn date                   |                                                              |                      | Multiple date operations                                                                                                        |
| mfn create @apollo:express |                                                              |                      | This will create apollo graphql express template project.                                                                       |
| mfn kill                   | -p 8080 4000                                                 |                      | This will kill process running on specific ports                                                                                |
| mfn update                 |                                                              |                      | This command update the CLI or a specified package to the latest version                                                        |
| mfn epoch                  |                                                              |                      | Perform epoch converstions                                                                                                      |

## Credits

These definitions were written by [Master4Novice](https://github.com/Master4Novice).
