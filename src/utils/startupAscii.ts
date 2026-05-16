const STARTUP_ASCII = String.raw`
            .-""""-.
         .-'  _  _  '-.
       .'    (o)(o)    '.
      /     .-.__.-.     \
     /     /  .--.  \     \
    ;      |  /    \  |     ;
    |      | |  /\  | |     |
    |      | |  \/  | |     |
    |      |  \_.._/  |     |
    ;       \   __   /      ;
     \       '.___.'       /
      '._                 _.'
         '-._         _.-'
              '-------'
`;

export function printStartupAscii(): void {
  process.stdout.write(`${STARTUP_ASCII}\n`);
}
