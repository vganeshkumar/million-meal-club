const ARCHITECTURE_DIAGRAM = `flowchart TB
    Browser["Visitor's Browser"]

    subgraph edge["Edge"]
        CF["CloudFront Distribution\\nmillionmealclub.com\\nPriceClass_100"]
    end

    subgraph origins["Origins"]
        direction LR
        S3Site["S3 — site bucket\\nNext.js static export"]
        APIGW["API Gateway\\nHTTP API"]
        S3Photos["S3 — photos bucket\\napproved/* only"]
    end

    subgraph compute["Compute"]
        Lambda["Lambda\\nFastAPI + Mangum\\ncontainer image via ECR"]
    end

    subgraph data["Data"]
        DDB[("DynamoDB\\n11 on-demand tables")]
    end

    subgraph external["External"]
        SES["SES\\ndonor onboarding email"]
        Google["Google Identity\\nOAuth token verification"]
    end

    Browser -->|HTTPS| CF
    CF -->|default behavior| S3Site
    CF -->|"/api/*"| APIGW
    CF -->|"/approved/*"| S3Photos
    APIGW --> Lambda
    Lambda --> DDB
    Lambda -->|"presigned PUT (browser uploads directly)\\nCopyObject on approval"| S3Photos
    Lambda -->|SendEmail| SES
    Lambda -.->|verify ID token| Google`;

const MODULE_DIAGRAM = `flowchart LR
    subgraph modules["infra/modules/"]
        data["data\\nDynamoDB tables"]
        photos["photos\\nS3 photos bucket +\\nlifecycle + OAC"]
        api["api\\nECR · Lambda · API Gateway · IAM"]
        static_site["static-site\\nS3 site bucket +\\nCloudFront distribution"]
        dns["dns\\nACM cert + Route53\\n(optional)"]
    end

    api --> photos
    api --> data
    static_site --> api
    static_site --> photos
    static_site --> dns

    subgraph envs["infra/envs/"]
        dev["dev\\n(destroyed — see below)"]
        prod["prod\\nmillionmealclub.com"]
    end

    dev -.-> modules
    prod --> modules`;

const AWS_SERVICES: { service: string; role: string; why: string }[] = [
  {
    service: "CloudFront",
    role: "Single edge distribution, 3 path-routed behaviors",
    why: "One domain for app + API + photos; PriceClass_100 keeps it to the cheapest edge locations (US/Canada/Europe)",
  },
  {
    service: "S3 (×2)",
    role: "Static site export; private photo storage",
    why: "No servers to render HTML; photos bucket is prefix-scoped private, never bulk-public",
  },
  {
    service: "Lambda",
    role: "FastAPI backend (via Mangum ASGI adapter), packaged as a container image",
    why: "Zero idle cost; container image (not zip) because the dependency set is more comfortable under Lambda's 10 GB image limit than zip/layer limits",
  },
  {
    service: "API Gateway (HTTP API)",
    role: "Fronts the Lambda",
    why: "HTTP API, not REST API — cheaper, and this app doesn't need REST API's extra features",
  },
  {
    service: "DynamoDB",
    role: "11 tables, all on-demand billing",
    why: "Traffic is low and spiky — a charity site, not a high-QPS product. On-demand has zero idle cost and stays inside DynamoDB's always-free tier for a long time",
  },
  {
    service: "ECR",
    role: "Holds the Lambda's container image",
    why: "Required by the container-image packaging choice above",
  },
  {
    service: "SES",
    role: "Donor-onboarding email on approval",
    why: "AWS-native, no third-party vendor relationship for one transactional email",
  },
  {
    service: "Route53 + ACM",
    role: "Custom domain + TLS cert",
    why: "Only provisioned when a domain is actually configured — conditional in Terraform, not hardcoded",
  },
  {
    service: "IAM",
    role: "One Lambda execution role, one inline policy",
    why: "Everything the backend can touch is enumerated by exact ARN — see Security below",
  },
  {
    service: "CloudWatch Logs",
    role: "Lambda logs, 14-day retention",
    why: "Default AWS Lambda logging, capped retention to bound cost",
  },
];

function DiagramBlock({ title, source }: { title: string; source: string }) {
  return (
    <div className="my-6 overflow-x-auto rounded-2xl border border-border bg-bg-alt p-5">
      <p className="m-0 mb-3 text-[12px] font-bold tracking-[0.06em] text-muted-2 uppercase">
        {title} (diagram source)
      </p>
      <pre className="m-0 font-mono text-[12.5px] leading-[1.6] text-muted whitespace-pre">
        {source}
      </pre>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-11">
      <h2 className="mt-0 mb-4 font-display text-2xl font-extrabold tracking-[-0.01em]">
        {title}
      </h2>
      <div className="flex flex-col gap-4 text-[15px] leading-[1.75] text-muted">
        {children}
      </div>
    </div>
  );
}

// Full writeup, condensed from `blog_infra.md`. Mermaid diagrams render as
// their source in a monospace block rather than a rendered graphic — no
// mermaid dependency has been added to the static export, per the
// constitution's static-first / no-unneeded-deps posture.
export function EngineeringBlogPost() {
  return (
    <div className="mx-auto max-w-[820px] px-[clamp(20px,5vw,56px)] pt-[clamp(40px,6vw,72px)] pb-[100px]">
      <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
        Behind The Scenes
      </span>
      <h1 className="mt-3 mb-8 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
        The Infrastructure Behind The Million Meal Club
      </h1>

      <p className="mb-11 text-[15px] leading-[1.75] text-muted">
        The Million Meal Club is a volunteer-run charity site: donors commit
        to delivering meals, volunteers help with logistics, and every
        delivery is verified by photo proof before it counts toward the
        public total. No money ever moves through the site — it&apos;s
        purely a coordination and accountability layer. What follows is the
        infrastructure that runs it: entirely on AWS, entirely serverless,
        provisioned entirely through Terraform.
      </p>

      <Section title="Architecture at a glance">
        <p>
          Everything sits behind a single CloudFront distribution,
          path-routed to three origins. That&apos;s a deliberate choice, not
          an accident — more on why below.
        </p>
        <DiagramBlock title="Architecture" source={ARCHITECTURE_DIAGRAM} />
        <p>
          <strong className="text-ink">
            Why one distribution, three behaviors, instead of separate
            domains for the app and the API?
          </strong>{" "}
          Same-origin. The session cookie can be{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            SameSite=Lax
          </code>{" "}
          instead of needing cross-site{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            SameSite=None; Secure
          </code>{" "}
          workarounds, and API calls need no CORS preflight at all. The only
          thing that does need its own CORS policy is the direct-to-S3 photo
          upload (browser → S3, bypassing Lambda entirely to avoid payload
          size limits and unnecessary compute cost).
        </p>
      </Section>

      <Section title="AWS services, and why each one">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px]">
            <thead>
              <tr className="bg-bg-alt">
                <th className="border-b border-border px-4 py-3 font-bold text-ink">
                  Service
                </th>
                <th className="border-b border-border px-4 py-3 font-bold text-ink">
                  Role
                </th>
                <th className="border-b border-border px-4 py-3 font-bold text-ink">
                  Why this, not the alternative
                </th>
              </tr>
            </thead>
            <tbody>
              {AWS_SERVICES.map((row) => (
                <tr key={row.service} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 align-top font-bold text-ink">
                    {row.service}
                  </td>
                  <td className="px-4 py-3 align-top">{row.role}</td>
                  <td className="px-4 py-3 align-top">{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Notably absent: <strong className="text-ink">no RDS, no ECS/Fargate,
          no EC2, no Cognito</strong>. Auth is Google OAuth verified
          server-side plus a self-issued signed session JWT — a stateless
          approach that didn&apos;t need a User Pool. Everything here either
          scales to zero or has a fixed, tiny footprint.
        </p>
      </Section>

      <Section title="Terraform module layout">
        <DiagramBlock title="Module layout" source={MODULE_DIAGRAM} />
        <p>
          Five modules, two environments.{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            dns
          </code>{" "}
          is the only optional one — it&apos;s skipped entirely when{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            domain_name
          </code>{" "}
          is empty, which is how <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">dev</code>{" "}
          ran (on CloudFront&apos;s own <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">*.cloudfront.net</code>{" "}
          domain, no custom domain needed for a throwaway environment).
        </p>
        <p>
          A few things live at the environment root instead of inside a
          module, specifically because of dependency ordering:
        </p>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong className="text-ink">S3 bucket policies</strong> (site +
            photos) need the CloudFront distribution&apos;s ARN, which
            doesn&apos;t exist until <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">static-site</code>{" "}
            is created — but{" "}
            <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
              static-site
            </code>{" "}
            itself needs the buckets to exist first. Root-level resources
            break that cycle.
          </li>
          <li>
            <strong className="text-ink">
              The aws_ses_email_identity
            </strong>{" "}
            is a root-level resource (not inside{" "}
            <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
              api
            </code>
            ) because it&apos;s optional — only created when a sending
            address is configured — and{" "}
            <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
              api
            </code>{" "}
            needs its ARN once it exists.
          </li>
        </ul>
        <p>
          Terraform state lives remotely: an S3 bucket (versioned) plus a
          DynamoDB table for locking, bootstrapped once by hand before any{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            terraform init
          </code>{" "}
          — Terraform can&apos;t create the backend it&apos;s about to store
          state in.
        </p>
      </Section>

      <Section title="Security posture">
        <p>
          <strong className="text-ink">No public buckets, anywhere.</strong>{" "}
          Both S3 buckets have Block Public Access fully enabled. CloudFront
          reaches them exclusively through an Origin Access Control (OAC),
          SigV4-signed — there is no path to either bucket that
          doesn&apos;t go through CloudFront&apos;s signed request.
        </p>
        <p>
          <strong className="text-ink">Prefix-scoped photo access.</strong>{" "}
          The photos bucket policy grants CloudFront read access to{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            approved/*
          </code>{" "}
          only.{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            pending/*
          </code>{" "}
          — proof photos awaiting founder review — is unreachable from the
          public internet at all. A photo only becomes publicly linkable
          after a human approves it, enforced with a real{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            CopyObject
          </code>{" "}
          at approval time, not a permissions flip.
        </p>
        <p>
          <strong className="text-ink">
            Least-privilege IAM, enumerated, not wildcarded.
          </strong>{" "}
          The Lambda&apos;s inline policy lists exact DynamoDB table ARNs and
          exact S3 key-prefix ARNs — no{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            dynamodb:*
          </code>
          , no bucket-wide{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            s3:*
          </code>
          .
        </p>
        <p>
          <strong className="text-ink">
            OAuth-only, no password database.
          </strong>{" "}
          Google Identity Services runs client-side; the backend verifies the
          ID token against Google&apos;s own public keys and issues its own
          signed session JWT as an HttpOnly, Secure, SameSite=Lax cookie.
          Admin access reuses the exact same login — the backend just checks
          the verified email against an allowlist.
        </p>
        <p>
          <strong className="text-ink">
            terraform apply is written policy as a human action
          </strong>{" "}
          — nobody, including an AI agent, runs it against real
          infrastructure without an explicit, specific ask in the moment.
          The one real gap this project found in its own defenses: the
          production Environment gate existed but initially had zero
          required reviewers configured, meaning apply would have run
          unattended on any merge touching infra/. It was caught during a
          routine PR review and fixed before anything else merged. A policy
          written down is not the same as a policy enforced.
        </p>
      </Section>

      <Section title="Cost posture">
        <p>Every layer here bills per-use, and most of it has a real, generous always-free tier:</p>
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong className="text-ink">
              Lambda + API Gateway HTTP API
            </strong>{" "}
            — pay per request/per millisecond, no idle floor.
          </li>
          <li>
            <strong className="text-ink">DynamoDB on-demand</strong> — zero
            cost when nothing&apos;s happening, scales automatically when
            something is.
          </li>
          <li>
            <strong className="text-ink">S3 + CloudFront</strong> — pay per
            GB stored/transferred, PriceClass_100 keeps CloudFront to its
            cheapest edge-location tier.
          </li>
          <li>
            A lifecycle rule expires anything under{" "}
            <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
              photos/pending/*
            </code>{" "}
            after 30 days — abandoned uploads don&apos;t accumulate storage
            cost indefinitely.
          </li>
          <li>
            <strong className="text-ink">No fixed monthly floor.</strong> No
            RDS instance idling, no EC2/Fargate task running 24/7 for
            occasional traffic.
          </li>
        </ul>
        <p>
          The most concrete proof of this cost model: once the{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            dev
          </code>{" "}
          environment had served its purpose, it was torn down entirely —{" "}
          <code className="rounded bg-bg-alt px-1.5 py-0.5 text-[13.5px]">
            terraform destroy
          </code>{" "}
          removed all 35 resources in one pass, cleanly, with zero resources
          left behind to keep billing.
        </p>
      </Section>

      <Section title="The shape of it">
        <p>
          Two environments, five Terraform modules, roughly a dozen AWS
          services, and not one of them runs continuously waiting for
          traffic. The project&apos;s constitution states the philosophy
          plainly: &ldquo;if a future requirement can&apos;t fit serverless
          compute, that&apos;s a conversation to have explicitly — don&apos;t
          quietly reach for a box that runs 24/7.&rdquo; Nothing here needed
          that conversation yet.
        </p>
      </Section>
    </div>
  );
}

type EngineeringBlogTeaserProps = {
  onOpen: () => void;
};

export function EngineeringBlogTeaser({ onOpen }: EngineeringBlogTeaserProps) {
  return (
    <section className="mx-auto max-w-[1160px] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,64px)]">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] border border-border bg-card px-8 py-7">
        <div>
          <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
            Behind The Scenes
          </span>
          <h2 className="mt-2 mb-2 font-display text-xl font-extrabold tracking-[-0.01em]">
            How this site is built
          </h2>
          <p className="m-0 max-w-[520px] text-[14.5px] leading-[1.6] text-muted">
            Curious about the engineering? Read how the whole thing runs
            serverless on AWS, provisioned entirely through Terraform.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="flex-shrink-0 cursor-pointer rounded-full border border-border-strong bg-transparent px-5 py-2.5 text-sm font-bold text-ink"
        >
          Read the writeup →
        </button>
      </div>
    </section>
  );
}
