import 'zone.js';
import {
  HttpInterceptorFn,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { map } from 'rxjs';
import { DeviceAppComponent } from './app/device-app.component';

const serviceApi: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);

  const apiOrigin = `${location.protocol}//${location.hostname}:8765`;
  return next(request.clone({ url: `${apiOrigin}${request.url}` })).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse)) return event;

      const body = event.body;
      if (body && typeof body === 'object') {
        const envelope = body as { status?: unknown; data?: unknown; };
        if (envelope.status === 'SUCCESS' && 'data' in envelope) {
          return event.clone({ body: envelope.data });
        }
      }
      return event;
    }),
  );
};

bootstrapApplication(DeviceAppComponent, {
  providers: [provideHttpClient(withInterceptors([serviceApi]))],
}).catch(console.error);
