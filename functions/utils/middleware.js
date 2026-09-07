import sentryPlugin from "@cloudflare/pages-plugin-sentry";
import '@sentry/tracing';
import { fetchOthersConfig } from "./sysConfig";
import { checkDatabaseConfig as checkDbConfig } from './databaseAdapter.js';
import { runTelemetryRequest, sanitizeTelemetryEvent } from './telemetryPrivacy.js';

export async function errorHandling(context) {
  // 读取KV中的设置
  const othersConfig = await fetchOthersConfig(context.env);
  const disableTelemetry = !othersConfig.telemetry.enabled;

  const env = context.env;
  if (!disableTelemetry) {
    context.data.telemetry = true;
    let remoteSampleRate = 0.001;
    try {
      const sampleRate = await fetchSampleRate(context)
      //check if the sample rate is not null
      if (sampleRate) {
        remoteSampleRate = sampleRate;
      }
    } catch (e) { console.log(e) }
    const sampleRate = env.sampleRate || remoteSampleRate;
    return sentryPlugin({
      dsn: "https://44b7b443108ec6d298044b125ff89d28@o4507644548022272.ingest.us.sentry.io/4507644555100160",
      tracesSampleRate: sampleRate,
      requestDataOptions: {
        allowedHeaders: [],
        allowedCookies: [],
        allowedSearchParams: [],
        allowedIps: [],
      },
      beforeSend: sanitizeTelemetryEvent,
      beforeSendTransaction: sanitizeTelemetryEvent,
    })(context);;
  }

  return context.next();
}

export async function telemetryData(context) {
  // 读取KV中的设置
  const othersConfig = await fetchOthersConfig(context.env);
  const disableTelemetry = !othersConfig.telemetry.enabled;
  
  if (!disableTelemetry) {
    return runTelemetryRequest(context);
  }

  return context.next();
}

export async function traceData(context, span, op, name) {
  const data = context.data
  if (data.telemetry) {
    if (span) {
      console.log("span finish")
      span.finish();
    } else {
      console.log("span start")
      span = await context.data.transaction.startChild(
        { op: op, name: name },
      );
    }
  }
}

async function fetchSampleRate(context) {
  const data = context.data
  if (data.telemetry) {
    const url = "https://frozen-sentinel.pages.dev/signal/sampleRate.json";
    const response = await fetch(url);
    const json = await response.json();
    return json.rate;
  }
}

// 检查数据库是否配置
export async function checkDatabaseConfig(context) {
  var env = context.env;

  var dbConfig = checkDbConfig(env);

  if (!dbConfig.configured) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "数据库未配置 / Database not configured",
        message: "请配置 KV 存储 (env.img_url) 或 D1 数据库 (env.img_d1)。 / Please configure KV storage (env.img_url) or D1 database (env.img_d1)."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }

  // 继续执行
  return await context.next();
}
