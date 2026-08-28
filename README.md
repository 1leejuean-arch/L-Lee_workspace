# L-Lee Workspace

Next.js 개발 서버는 `http://localhost:3002`에서 실행됩니다.

## Windows 개발 실행 순서

터미널을 다음과 같이 나누어 사용하는 것을 권장합니다.

- 1번 터미널: build, git, commit, push 작업
- 2번 터미널: `npm run dev` 개발 서버 전용

`npm run dev`가 실행 중일 때 다른 터미널에서 `npm run build` 또는 `npm run build:clean`을 동시에 실행하지 마세요. 두 명령이 같은 `.next` 폴더를 사용하므로 캐시 파일 잠금이나 누락 오류가 발생할 수 있습니다.

빌드 전에는 2번 터미널에서 `Ctrl+C`를 눌러 개발 서버를 완전히 종료한 다음 실행하세요.

```powershell
npm run build:clean
```

빌드가 끝난 뒤 개발을 계속하려면 다음 명령으로 서버를 다시 시작합니다.

```powershell
npm run dev
```

## `.next` 캐시 오류 복구

개발 서버가 꼬였을 때:

```powershell
npm run dev:reset
```

이 명령어는 현재 복구 명령을 실행하는 npm 프로세스를 제외한 Node 서버를 종료하고, `.next` 캐시를 지운 뒤 3002 포트로 개발 서버를 다시 실행합니다. 실행 중인 다른 Node 개발 서버도 종료될 수 있으므로 필요한 작업을 먼저 저장하세요.

`webpack.js`, `layout.js`, `prerender-manifest.json` 관련 `UNKNOWN` 또는 `ENOENT` 오류가 발생하면 실행 중인 개발 서버를 먼저 `Ctrl+C`로 종료하고 다음 명령을 사용하세요.

```powershell
npm run dev:clean
```

이 명령은 `.next` 폴더를 삭제한 뒤 3002 포트에서 개발 서버를 다시 실행합니다.

`EADDRINUSE :::3002`가 표시되면 이미 실행 중인 개발 서버가 있는지 다른 VS Code 터미널을 확인하고 해당 서버를 `Ctrl+C`로 종료하세요. 서버가 완전히 종료된 후 `npm run dev:clean`을 다시 실행합니다.

배포 전 최종 검증은 개발 서버를 끈 상태에서 다음 명령을 사용합니다.

```powershell
npm run build:clean
```

## npm scripts

- `npm run dev`: 3002 포트에서 개발 서버 실행
- `npm run clean`: Windows PowerShell로 `.next` 캐시 삭제
- `npm run kill:node`: 현재 npm 실행 프로세스를 제외한 Node 프로세스 강제 종료
- `npm run dev:clean`: 캐시 삭제 후 개발 서버 실행
- `npm run dev:reset`: Node 서버 종료, 캐시 삭제 후 개발 서버 실행
- `npm run build`: 프로덕션 빌드 실행
- `npm run build:clean`: 캐시 삭제 후 프로덕션 빌드 실행
- `npm run start`: 프로덕션 서버를 3002 포트에서 실행
