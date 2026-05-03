import Image, { type ImageProps } from 'next/image';
import styles from './page.module.css';

type Props = Omit<ImageProps, 'src'> & {
  srcLight: string;
  srcDark: string;
};

const ThemeImage = (props: Props) => {
  const { srcLight, srcDark, ...rest } = props;

  return (
    <>
      <Image {...rest} src={srcLight} className="imgLight" />
      <Image {...rest} src={srcDark} className="imgDark" />
    </>
  );
};

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <ThemeImage
          className={styles.logo}
          srcLight="turborepo-dark.svg"
          srcDark="turborepo-light.svg"
          alt="Turborepo logo"
          width={180}
          height={38}
          priority
        />
        <ol>
          <li>
            Get started by editing <code>apps/web/app/page.tsx</code>
          </li>
          <li>Save and see your changes instantly.</li>
        </ol>

        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnarevai%2Fchatbot-with-billing-polar&env=AUTH_SECRET,AI_GATEWAY_API_KEY,POLAR_ACCESS_TOKEN,POLAR_SERVER&envDefaults=%7B%22POLAR_SERVER%22%3A%22sandbox%22%2C%22AUTH_SECRET%22%3A%2275cae24031799503fbe48e750556f0ea%22%2C%22AI_GATEWAY_API_KEY%22%3A%22vck_***%22%2C%22POLAR_ACCESS_TOKEN%22%3A%22polar_oat_***%22%7D&envDescription=Generate%20AUTH_SECRET%20at%20generate-secret.vercel.app%2F32.%20Get%20POLAR_ACCESS_TOKEN%20from%20polar.sh.%20Get%20AI_GATEWAY_API_KEY%20from%20vercel.com%2Fai-gateway.&stores=%5B%7B%22type%22%3A%22postgres%22%7D%2C%7B%22type%22%3A%22blob%22%7D%2C%7B%22type%22%3A%22kv%22%7D%5D&skippable-integrations=1&demo-title=AI+Chatbot+with+Polar+Billing&demo-description=A+production-ready+chatbot+template+featuring+integrated+usage-based+billing.&project-name=ai-billing-bot&repository-name=ai-billing-bot&utm_source=github_readme"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className={styles.logo}
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            href="https://turborepo.dev/docs?utm_source"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondary}
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className={styles.footer}>
        <a
          href="https://vercel.com/templates?search=turborepo&utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          href="https://turborepo.dev?utm_source=create-turbo"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to turborepo.dev →
        </a>
      </footer>
    </div>
  );
}
